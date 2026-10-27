<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Batch;
use App\Models\Scopes\BranchScope;
use App\Models\StockReservation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Owns the atomic reserve/release logic from the Inventory Module spec
 * (Section 4). This module does not own the Client Order Form's status
 * machine — the Sales module's COF-approval action is expected to call
 * `reserve()` at the exact moment a COF is sent to Purchasing, as a plain
 * internal method call, not through an inventory HTTP endpoint. Section 1's
 * "Sales has no inventory access" is about this module's own endpoints; it
 * does not prevent another module's authorized action from invoking this
 * service internally.
 */
class ReservationService
{
    public function __construct(
        private readonly StockAvailabilityService $availability,
        private readonly StockLevelNotifier $notifier,
    ) {}

    /**
     * @throws InsufficientStockException
     */
    public function reserve(
        int $itemId,
        int $branchId,
        int $quantity,
        string $referenceType,
        int $referenceId,
    ): StockReservation {
        return DB::transaction(function () use ($itemId, $branchId, $quantity, $referenceType, $referenceId) {
            // Locking every active batch row for this item+branch is what
            // serializes concurrent reservation attempts against the same
            // stock: a second transaction blocks here until the first
            // commits, then its subsequent reads see the first's committed
            // reservation rather than a stale pre-commit snapshot — this is
            // the race the spec calls out explicitly (two orders approved
            // seconds apart both seeing "10 available").
            $currentStock = (int) Batch::query()
                ->withoutGlobalScope(BranchScope::class)
                ->where('item_id', $itemId)
                ->where('branch_id', $branchId)
                ->where('status', 'active')
                ->lockForUpdate()
                ->pluck('quantity')
                ->sum();

            $availableBefore = $currentStock - $this->availability->reservedStock($itemId, $branchId);

            if ($quantity > $availableBefore) {
                throw new InsufficientStockException($itemId, $branchId, $quantity, $availableBefore);
            }

            $reservation = StockReservation::create([
                'item_id' => $itemId,
                'branch_id' => $branchId,
                'quantity' => $quantity,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'status' => 'active',
            ]);

            $this->notifier->decreased($itemId, $branchId, $availableBefore);

            return $reservation;
        });
    }

    /**
     * Must run in the same transaction as whatever status change caused the
     * release (e.g. a COF cancellation) — the caller is responsible for
     * wrapping that broader transaction; this method's own DB::transaction
     * only guards this row's own read-then-write.
     */
    public function release(StockReservation $reservation): void
    {
        DB::transaction(function () use ($reservation) {
            StockReservation::query()
                ->withoutGlobalScope(BranchScope::class)
                ->whereKey($reservation->id)
                ->lockForUpdate()
                ->firstOrFail();

            $reservation->update(['status' => 'released']);

            $this->notifier->changed($reservation->item_id, $reservation->branch_id);
        });
    }

    public function releaseAllFor(string $referenceType, int $referenceId): void
    {
        DB::transaction(function () use ($referenceType, $referenceId) {
            $this->forReference($referenceType, $referenceId)
                ->where('status', 'active')
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->each(fn (StockReservation $reservation) => $this->release($reservation));
        });
    }

    public function hasReservationsFor(string $referenceType, int $referenceId): bool
    {
        return $this->forReference($referenceType, $referenceId)->exists();
    }

    public function consume(string $referenceType, int $referenceId, int $itemId, int $branchId, int $quantity): void
    {
        DB::transaction(function () use ($referenceType, $referenceId, $itemId, $branchId, $quantity) {
            $reservation = $this->forReference($referenceType, $referenceId)
                ->where('item_id', $itemId)
                ->where('branch_id', $branchId)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (! $reservation) {
                throw new LogicException("No active reservation for item {$itemId} on {$referenceType} {$referenceId}.");
            }

            $remaining = max(0, $reservation->quantity - $quantity);

            $reservation->update([
                'quantity' => $remaining,
                'status' => $remaining === 0 ? 'fulfilled' : 'active',
            ]);
        });
    }

    private function forReference(string $referenceType, int $referenceId): Builder
    {
        return StockReservation::query()
            ->withoutGlobalScope(BranchScope::class)
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId);
    }
}
