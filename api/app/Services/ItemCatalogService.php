<?php

namespace App\Services;

use App\Models\Item;
use Illuminate\Database\Eloquent\Builder;

class ItemCatalogService
{
    public function activeItemsQuery(?string $search, ?int $categoryId): Builder
    {
        return Item::query()
            ->with(['category', 'unit'])
            ->where('is_active', true)
            ->when($categoryId, fn (Builder $query, int $id) => $query->where('category_id', $id))
            ->when($search, function (Builder $query, string $term) {
                $pattern = '%'.$term.'%';
                $query->where(fn (Builder $inner) => $inner->whereLike('name', $pattern)->orWhereLike('sku', $pattern));
            })
            ->orderBy('name');
    }
}
