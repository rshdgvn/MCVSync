<?php

namespace App\Http\Controllers\Staff\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Inventory\StoreItemRequest;
use App\Http\Requests\Staff\Inventory\UpdateItemRequest;
use App\Http\Resources\ItemResource;
use App\Http\Resources\ItemWithCogsResource;
use App\Models\Item;
use App\Models\Scopes\BranchScope;
use App\Services\InventoryService;
use App\Services\PricingService;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Item::class);

        $items = Item::query()
            ->with(['category', 'unit'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = '%'.$request->string('search').'%';
                $query->where(fn ($inner) => $inner->where('name', 'like', $search)->orWhere('sku', 'like', $search));
            })
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('branch_id'), function ($query) use ($request) {
                $branchId = $request->integer('branch_id');

                $query->whereHas('batches', function ($batchQuery) use ($branchId) {
                    $batchQuery->withoutGlobalScope(BranchScope::class)
                        ->where('branch_id', $branchId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0);
                });
            })
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return ItemResource::collection($items);
    }

    public function show(Item $item, PricingService $pricing)
    {
        $this->authorize('view', $item);

        $item->load(['category', 'unit']);
        $item->setAttribute('cogs', $pricing->cogsFor($item->id));

        return new ItemWithCogsResource($item);
    }

    public function store(StoreItemRequest $request, InventoryService $inventory)
    {
        $this->authorize('create', Item::class);

        $item = $inventory->createItem($request->validated());

        return (new ItemResource($item->load(['category', 'unit'])))->response()->setStatusCode(201);
    }

    public function update(UpdateItemRequest $request, Item $item, InventoryService $inventory)
    {
        $this->authorize('update', $item);

        $item = $inventory->updateItem($item, $request->validated());

        return new ItemResource($item->load(['category', 'unit']));
    }
}
