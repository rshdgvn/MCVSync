<?php

namespace App\Services;

use App\Events\LowStockThresholdCrossed;
use App\Events\StockLevelChanged;
use App\Exceptions\InsufficientStockException;
use App\Models\Batch;
use App\Models\Item;
use App\Models\Scopes\BranchScope;
use App\Models\StockReservation;
use Illuminate\Support\Facades\DB;

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
    public function __construct(private readonly StockAvailabilityService $availability) {}

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

            $reservedStock = $this->availability->reservedStock($itemId, $branchId);
            $availableBefore = $currentStock - $reservedStock;

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

            $availableAfter = $availableBefore - $quantity;

            StockLevelChanged::dispatch($itemId, $branchId, $availableAfter, $reservedStock + $quantity, $currentStock);

            $reorderPoint = Item::where('id', $itemId)->value('reorder_point');

            if ($reorderPoint !== null && $availableBefore > $reorderPoint && $availableAfter <= $reorderPoint) {
                LowStockThresholdCrossed::dispatch($itemId, $branchId, $availableAfter, $reorderPoint);
            }

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

            $itemId = $reservation->item_id;
            $branchId = $reservation->branch_id;
            $current = $this->availability->currentStock($itemId, $branchId);
            $reserved = $this->availability->reservedStock($itemId, $branchId);

            // Releasing only ever increases availability, so it can never
            // newly cross into low-stock — only reserve() can do that.
            StockLevelChanged::dispatch($itemId, $branchId, $current - $reserved, $reserved, $current);
        });
    }

    // Fulfillment (reservation -> fulfilled, FEFO batch decrement, and the
    // stock_transactions write, all in one transaction) is explicitly the
    // Receiving/Issuing Stock spec's responsibility, not this module's —
    // see Section 4's closing note. Not stubbed here on purpose: a partial
    // status-only implementation would be worse than none, since it would
    // look complete without doing the batch/transaction work that must
    // happen atomically alongside it.
}
