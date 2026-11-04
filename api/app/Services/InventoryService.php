<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Item;
use App\Models\Scopes\BranchScope;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Category/unit/item CRUD orchestration — kept out of the controllers per
 * CLAUDE.md's "thin controllers, logic in services" rule, even though most
 * of these methods are simple, so every inventory controller follows the
 * same shape.
 */
class InventoryService
{
    public function createCategory(array $data): Category
    {
        return Category::create($data);
    }

    public function updateCategory(Category $category, array $data): Category
    {
        $category->update($data);

        return $category;
    }

    public function deleteCategory(Category $category): void
    {
        if ($category->items()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'This category is still assigned to one or more items and cannot be deleted.',
            ]);
        }

        $category->delete();
    }

    public function createUnit(array $data): Unit
    {
        return Unit::create($data);
    }

    public function updateUnit(Unit $unit, array $data): Unit
    {
        $unit->update($data);

        return $unit;
    }

    public function deleteUnit(Unit $unit): void
    {
        if ($unit->items()->exists()) {
            throw ValidationException::withMessages([
                'unit' => 'This unit is still assigned to one or more items and cannot be deleted.',
            ]);
        }

        $unit->delete();
    }

    public function createItem(array $data): Item
    {
        return Item::create($data);
    }

    public function updateItem(Item $item, array $data): Item
    {
        $item->update($data);

        return $item;
    }

    public function itemsQuery(array $filters): Builder
    {
        return $this->filteredItems($filters)
            ->with(['category', 'unit'])
            ->withSum(['batches as on_hand' => fn (Builder $query) => $query->where('status', 'active')], 'quantity')
            ->withSum(['stockReservations as reserved' => fn (Builder $query) => $query->where('status', 'active')], 'quantity')
            ->when(isset($filters['is_active']), fn (Builder $query) => $query->where('is_active', $filters['is_active']))
            ->orderBy('name');
    }

    public function itemStatusCounts(array $filters): array
    {
        $totals = $this->filteredItems($filters)
            ->toBase()
            ->selectRaw('is_active, COUNT(*) as total')
            ->groupBy('is_active')
            ->pluck('total', 'is_active');

        $active = (int) ($totals[1] ?? 0);
        $inactive = (int) ($totals[0] ?? 0);

        return ['all' => $active + $inactive, 'active' => $active, 'inactive' => $inactive];
    }

    private function filteredItems(array $filters): Builder
    {
        return Item::query()
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $pattern = '%'.$search.'%';
                $query->where(fn (Builder $inner) => $inner->whereLike('name', $pattern)->orWhereLike('sku', $pattern));
            })
            ->when($filters['category_id'] ?? null, fn (Builder $query, int $categoryId) => $query->where('category_id', $categoryId))
            ->when($filters['branch_id'] ?? null, function (Builder $query, int $branchId) {
                $query->whereHas('batches', function (Builder $batchQuery) use ($branchId) {
                    $batchQuery->withoutGlobalScope(BranchScope::class)
                        ->where('branch_id', $branchId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0);
                });
            });
    }
}
