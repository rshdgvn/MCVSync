<?php

namespace App\Services;

use App\Models\ClientItemPrice;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The one place in the codebase that knows how to answer "what does this
 * client pay for this item" — the future Sales module calls this rather
 * than querying client_item_prices directly, so "needs pricing" (a
 * missing row) only needs to be implemented once.
 */
class PricingService
{
    /**
     * Every "most recent row" lookup in this service orders by created_at
     * DESC with id DESC as a tiebreaker — SQLite's timestamp columns are
     * only second-precision, so two prices set within the same second
     * (a real possibility, not just a test artifact) tie on created_at,
     * and without the tiebreaker the actual latest one is ambiguous.
     */
    public function currentPrice(int $clientId, int $itemId): ?ClientItemPrice
    {
        return ClientItemPrice::query()
            ->where('client_id', $clientId)
            ->where('item_id', $itemId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Not called by any endpoint in this pass — the Sales module's
     * "Needs Pricing" queue is what will call this, once Client Order
     * Forms exist to build that queue from.
     */
    public function hasPrice(int $clientId, int $itemId): bool
    {
        return ClientItemPrice::query()
            ->where('client_id', $clientId)
            ->where('item_id', $itemId)
            ->exists();
    }

    public function history(int $clientId, int $itemId): Builder
    {
        return ClientItemPrice::query()
            ->where('client_id', $clientId)
            ->where('item_id', $itemId)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /**
     * Every current-price row for this table at once — a query builder,
     * not a Collection, so the controller can paginate it. Determines
     * which rows are "current" (latest per client+item pair) via an
     * indexed window function, then hands back a plain Eloquent query
     * over just those rows so the controller can eager-load relations
     * normally for the resource layer.
     */
    public function currentPricesQuery(?int $clientId, ?int $itemId): Builder
    {
        $latest = DB::table('client_item_prices as cip')
            ->when($clientId, fn ($query) => $query->where('cip.client_id', $clientId))
            ->when($itemId, fn ($query) => $query->where('cip.item_id', $itemId))
            ->selectRaw('cip.id, ROW_NUMBER() OVER (PARTITION BY cip.client_id, cip.item_id ORDER BY cip.created_at DESC, cip.id DESC) as rn');

        $ids = DB::query()->fromSub($latest, 'latest')->where('rn', 1)->pluck('id');

        return ClientItemPrice::query()->whereIn('id', $ids)->orderByDesc('created_at')->orderByDesc('id');
    }

    /**
     * The average of every client's *current* price for this item, among
     * clients in the given zone — never a raw average across every
     * historical row, which would let an old, since-renegotiated price
     * skew the figure. Reference only; never auto-filled into a new price.
     */
    public function zoneAverage(int $itemId, int $zoneId): ?float
    {
        $latestPerClient = DB::table('client_item_prices as cip')
            ->join('clients as c', 'c.id', '=', 'cip.client_id')
            ->where('c.zone_id', $zoneId)
            ->where('cip.item_id', $itemId)
            ->selectRaw('cip.client_id, cip.srp, ROW_NUMBER() OVER (PARTITION BY cip.client_id ORDER BY cip.created_at DESC, cip.id DESC) as rn');

        $average = DB::query()->fromSub($latestPerClient, 'latest')->where('rn', 1)->avg('srp');

        return $average !== null ? (float) $average : null;
    }

    public function setPrice(int $clientId, int $itemId, float $srp, Employee $setBy): ClientItemPrice
    {
        return ClientItemPrice::create([
            'client_id' => $clientId,
            'item_id' => $itemId,
            'srp' => $srp,
            'set_by' => $setBy->id,
        ]);
    }

    public function cogsFor(int $itemId): ?float
    {
        return $this->cogsForMany([$itemId])[$itemId] ?? null;
    }

    /**
     * @param  array<int, int>  $itemIds
     * @return array<int, float>
     */
    public function cogsForMany(array $itemIds): array
    {
        if (empty($itemIds)) {
            return [];
        }

        $latest = DB::table('purchase_order_items as poi')
            ->whereIn('poi.item_id', $itemIds)
            ->selectRaw('poi.item_id, poi.unit_cost, ROW_NUMBER() OVER (PARTITION BY poi.item_id ORDER BY poi.created_at DESC, poi.id DESC) as rn');

        return DB::query()->fromSub($latest, 'latest')
            ->where('rn', 1)
            ->pluck('unit_cost', 'item_id')
            ->map(fn ($cost) => (float) $cost)
            ->all();
    }
}
