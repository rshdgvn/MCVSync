<?php

namespace App\Services;

use App\Models\ClientItemPrice;
use App\Models\Employee;
use App\Services\Concerns\ResolvesCurrentClientItemRow;
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
    use ResolvesCurrentClientItemRow;

    public function currentPrice(int $clientId, int $itemId): ?ClientItemPrice
    {
        return $this->latestRow($clientId, $itemId);
    }

    /**
     * @param  array<int, int>  $itemIds
     * @return array<int, float>
     */
    public function currentPricesFor(int $clientId, array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        return $this->currentRowsQuery($clientId, null, $itemIds)
            ->pluck('srp', 'item_id')
            ->map(fn ($srp) => (float) $srp)
            ->all();
    }

    public function hasPrice(int $clientId, int $itemId): bool
    {
        return ClientItemPrice::query()
            ->where('client_id', $clientId)
            ->where('item_id', $itemId)
            ->exists();
    }

    public function history(int $clientId, int $itemId): Builder
    {
        return $this->rowHistory($clientId, $itemId);
    }

    public function currentPricesQuery(?int $clientId, ?int $itemId): Builder
    {
        return $this->currentRowsQuery($clientId, $itemId);
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

    protected function clientItemModel(): string
    {
        return ClientItemPrice::class;
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
