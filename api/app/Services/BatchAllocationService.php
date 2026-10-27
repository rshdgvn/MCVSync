<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Scopes\BranchScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * The one place in the codebase that decides "which batch is next" for a
 * given item/branch — FEFO order. The Receiving/Issuing Stock spec is
 * expected to call this rather than reimplement the ordering.
 *
 * Bypasses Batch's BranchScope deliberately: branch is an explicit
 * parameter here, not implicit request context, so the two must never be
 * allowed to silently conflict.
 */
class BatchAllocationService
{
    public function nextAvailableBatch(int $itemId, int $branchId): ?Batch
    {
        return $this->availableInFefoOrder($itemId, $branchId)->first();
    }

    public function lockNextAvailableBatch(int $itemId, int $branchId): ?Batch
    {
        return $this->availableInFefoOrder($itemId, $branchId)->lockForUpdate()->first();
    }

    public function lockBatchForPick(int $batchId, int $itemId, int $branchId): ?Batch
    {
        return Batch::query()
            ->withoutGlobalScope(BranchScope::class)
            ->whereKey($batchId)
            ->where('item_id', $itemId)
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->lockForUpdate()
            ->first();
    }

    public function isFefoCompliant(Batch $batch): bool
    {
        $next = $this->nextAvailableBatch($batch->item_id, $batch->branch_id);

        return $next === null || $next->expiry_date?->toDateString() === $batch->expiry_date?->toDateString();
    }

    /**
     * Locked because this exists specifically for the Receiving Stock
     * write path's batch upsert — the only real caller — which needs the
     * row held for the rest of its transaction, not just a plain read.
     */
    public function findExistingBatch(int $itemId, int $branchId, string $batchNumber): ?Batch
    {
        return Batch::query()
            ->withoutGlobalScope(BranchScope::class)
            ->where('item_id', $itemId)
            ->where('branch_id', $branchId)
            ->where('batch_number', $batchNumber)
            ->lockForUpdate()
            ->first();
    }

    private function availableInFefoOrder(int $itemId, int $branchId): Builder
    {
        return Batch::query()
            ->withoutGlobalScope(BranchScope::class)
            ->where('item_id', $itemId)
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('quantity', '>', 0)
            ->orderByRaw('expiry_date IS NULL')
            ->orderBy('expiry_date')
            ->orderBy('received_date')
            ->orderBy('id');
    }
}
