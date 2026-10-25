<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Scopes\BranchScope;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Owns the two live alert queries from the Inventory Module spec (Section
 * 5). Neither is a scheduled job that recomputes and stores a flag — both
 * run against the indexed paths live, so the result is never stale.
 */
class AlertService
{
    /**
     * Every active batch whose expiry falls within its item's own
     * threshold (or the config-backed default when the item doesn't set
     * one). SQLite runs the test suite and Postgres runs production, and
     * they have no shared date-difference function.
     */
    public function expiringBatches(?int $branchId, int $perPage = 15): LengthAwarePaginator
    {
        $defaultThreshold = config('inventory.default_expiry_alert_threshold_days');

        return Batch::query()
            ->withoutGlobalScope(BranchScope::class)
            ->join('items', 'items.id', '=', 'batches.item_id')
            ->where('batches.status', 'active')
            ->whereNotNull('batches.expiry_date')
            ->whereRaw(
                $this->daysUntilExpirySql().' <= COALESCE(items.expiry_alert_threshold_days, ?)',
                [now()->toDateString(), $defaultThreshold],
            )
            ->when($branchId !== null, fn ($query) => $query->where('batches.branch_id', $branchId))
            ->orderBy('batches.expiry_date')
            ->select('batches.*')
            ->with(['item.category', 'item.unit', 'branch'])
            ->paginate($perPage);
    }

    private function daysUntilExpirySql(): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => '(batches.expiry_date - CAST(? AS date))',
            default => 'CAST(julianday(batches.expiry_date) - julianday(?) AS INTEGER)',
        };
    }

    /**
     * Items whose computed available stock (Section 3) has dropped to or
     * below their reorder point. Computed entirely in SQL via joined
     * per-item-per-branch sums — never loads batches/reservations into
     * memory to do the arithmetic in PHP.
     */
    public function lowStockItems(?int $branchId, int $perPage = 15): LengthAwarePaginator
    {
        $batchSums = DB::table('batches')
            ->select('item_id', 'branch_id', DB::raw('SUM(quantity) as qty'))
            ->where('status', 'active')
            ->groupBy('item_id', 'branch_id');

        $reservationSums = DB::table('stock_reservations')
            ->select('item_id', 'branch_id', DB::raw('SUM(quantity) as qty'))
            ->where('status', 'active')
            ->groupBy('item_id', 'branch_id');

        return DB::table('items')
            ->crossJoin('branches')
            ->leftJoinSub($batchSums, 'batch_sums', function ($join) {
                $join->on('batch_sums.item_id', '=', 'items.id')
                    ->on('batch_sums.branch_id', '=', 'branches.id');
            })
            ->leftJoinSub($reservationSums, 'reservation_sums', function ($join) {
                $join->on('reservation_sums.item_id', '=', 'items.id')
                    ->on('reservation_sums.branch_id', '=', 'branches.id');
            })
            ->whereNotNull('items.reorder_point')
            ->where('items.is_active', true)
            ->when($branchId !== null, fn ($query) => $query->where('branches.id', $branchId))
            ->whereRaw('(COALESCE(batch_sums.qty, 0) - COALESCE(reservation_sums.qty, 0)) <= items.reorder_point')
            ->selectRaw(
                'items.id as item_id, items.name as item_name, items.sku, items.reorder_point, '.
                'branches.id as branch_id, branches.name as branch_name, '.
                '(COALESCE(batch_sums.qty, 0) - COALESCE(reservation_sums.qty, 0)) as available',
            )
            ->orderByRaw('(COALESCE(batch_sums.qty, 0) - COALESCE(reservation_sums.qty, 0)) ASC')
            ->paginate($perPage);
    }
}
