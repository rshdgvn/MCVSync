<?php

namespace App\Services\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

trait ResolvesCurrentClientItemRow
{
    /**
     * @return class-string<Model>
     */
    abstract protected function clientItemModel(): string;

    protected function latestRow(int $clientId, int $itemId): ?Model
    {
        return $this->rowHistory($clientId, $itemId)->first();
    }

    protected function rowHistory(int $clientId, int $itemId): Builder
    {
        return ($this->clientItemModel())::query()
            ->where('client_id', $clientId)
            ->where('item_id', $itemId)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /**
     * @param  array<int, int>  $itemIds
     */
    protected function currentRowsQuery(?int $clientId, ?int $itemId, array $itemIds = []): Builder
    {
        $model = $this->clientItemModel();
        $table = (new $model)->getTable();

        $latest = DB::table("{$table} as entry")
            ->when($clientId, fn ($query) => $query->where('entry.client_id', $clientId))
            ->when($itemId, fn ($query) => $query->where('entry.item_id', $itemId))
            ->when($itemIds !== [], fn ($query) => $query->whereIn('entry.item_id', $itemIds))
            ->selectRaw('entry.id, ROW_NUMBER() OVER (PARTITION BY entry.client_id, entry.item_id ORDER BY entry.created_at DESC, entry.id DESC) as rn');

        $ids = DB::query()->fromSub($latest, 'latest')->where('rn', 1)->pluck('id');

        return $model::query()->whereIn('id', $ids)->orderByDesc('created_at')->orderByDesc('id');
    }
}
