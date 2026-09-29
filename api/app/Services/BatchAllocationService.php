<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Scopes\BranchScope;

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
        return Batch::query()
            ->withoutGlobalScope(BranchScope::class)
            ->where('item_id', $itemId)
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('quantity', '>', 0)
            // Non-null expiry dates (true FEFO) sort before null ones
            // (non-expiring items), which then fall back to FIFO.
            ->orderByRaw('expiry_date IS NULL')
            ->orderBy('expiry_date')
            ->orderBy('received_date')
            ->first();
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
}
