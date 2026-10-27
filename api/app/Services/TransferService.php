<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\TransferRequest;
use App\Services\Concerns\EnforcesActingBranch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransferService
{
    use EnforcesActingBranch;

    public const LIST_RELATIONS = ['requestingBranch', 'fulfillingBranch', 'requestedBy.user'];

    public const DETAIL_RELATIONS = ['requestingBranch', 'fulfillingBranch', 'requestedBy.user', 'items.item.category', 'items.item.unit'];

    public function __construct(
        private readonly DocumentNumberGenerator $numbers,
        private readonly ReservationService $reservations,
    ) {}

    public function query(array $filters): Builder
    {
        return TransferRequest::query()
            ->with(self::LIST_RELATIONS)
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['requesting_branch_id'] ?? null, fn (Builder $query, int $branchId) => $query->where('requesting_branch_id', $branchId))
            ->when($filters['fulfilling_branch_id'] ?? null, fn (Builder $query, int $branchId) => $query->where('fulfilling_branch_id', $branchId))
            ->latest()
            ->orderByDesc('id');
    }

    public function create(array $data, array $items, Employee $requestedBy, ?int $actingBranchId): TransferRequest
    {
        $requestingBranchId = $this->toBranchId($actingBranchId ?? ($data['requesting_branch_id'] ?? null));
        $mainBranchId = $this->toBranchId(Branch::where('is_main', true)->value('id'));

        $this->assertValidRoute($requestingBranchId, $mainBranchId);

        return DB::transaction(function () use ($data, $items, $requestedBy, $requestingBranchId, $mainBranchId) {
            $transfer = TransferRequest::create([
                'transfer_number' => $this->numbers->next(TransferRequest::class, 'transfer_number', 'TR'),
                'requesting_branch_id' => $requestingBranchId,
                'fulfilling_branch_id' => $mainBranchId,
                'requested_by' => $requestedBy->id,
                'remarks' => $data['remarks'] ?? null,
            ]);

            $transfer->items()->createMany(array_map(fn (array $item) => [
                'item_id' => $item['item_id'],
                'quantity_requested' => $item['quantity'],
            ], $items));

            return $transfer;
        });
    }

    public function ship(TransferRequest $transfer, ?int $actingBranchId): TransferRequest
    {
        $this->assertPending($transfer, 'Only a pending transfer can be shipped.');
        $this->ensureActingBranch($actingBranchId, $transfer->fulfilling_branch_id, 'Only the main branch can ship this transfer.');

        return DB::transaction(function () use ($transfer) {
            $this->lock($transfer);

            $hasUnpickedLine = $transfer->items()->whereColumn('quantity_picked', '<', 'quantity_requested')->exists();

            if ($hasUnpickedLine) {
                throw ValidationException::withMessages([
                    'status' => 'Every line must be fully picked before the transfer can ship.',
                ]);
            }

            $transfer->update(['status' => 'shipped', 'shipped_at' => now()]);

            return $transfer;
        });
    }

    public function cancel(TransferRequest $transfer, ?int $actingBranchId): TransferRequest
    {
        $this->assertPending($transfer, 'Only a pending transfer can be cancelled.');
        $this->ensureActingBranch($actingBranchId, $transfer->requesting_branch_id, 'Only the requesting branch can cancel this transfer.');

        return DB::transaction(function () use ($transfer) {
            $this->lock($transfer);

            if ($transfer->items()->where('quantity_picked', '>', 0)->exists()) {
                throw ValidationException::withMessages([
                    'status' => 'Picking has already started, so this transfer can no longer be cancelled.',
                ]);
            }

            $this->reservations->releaseAllFor($transfer->getMorphClass(), $transfer->id);
            $transfer->update(['status' => 'cancelled']);

            return $transfer;
        });
    }

    private function assertValidRoute(?int $requestingBranchId, ?int $mainBranchId): void
    {
        if ($requestingBranchId === null) {
            throw ValidationException::withMessages([
                'requesting_branch_id' => 'Choose the branch that is requesting the stock.',
            ]);
        }

        if ($mainBranchId === null) {
            throw ValidationException::withMessages([
                'requesting_branch_id' => 'No main branch is configured to fulfill transfers.',
            ]);
        }

        if ($requestingBranchId === $mainBranchId) {
            throw ValidationException::withMessages([
                'requesting_branch_id' => 'The main branch fulfills transfers and cannot request one.',
            ]);
        }
    }

    private function toBranchId(int|string|null $branchId): ?int
    {
        return $branchId === null ? null : (int) $branchId;
    }

    private function assertPending(TransferRequest $transfer, string $message): void
    {
        if ($transfer->status !== 'pending') {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }

    private function lock(TransferRequest $transfer): void
    {
        $transfer->newQueryWithoutScopes()->whereKey($transfer->id)->lockForUpdate()->first();
    }
}
