<?php

namespace App\Http\Controllers\Staff\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Inventory\StoreItemRequest;
use App\Http\Requests\Staff\Inventory\UpdateItemRequest;
use App\Http\Resources\ItemResource;
use App\Http\Resources\ItemWithCogsResource;
use App\Models\Item;
use App\Services\InventoryService;
use App\Services\PricingService;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index(Request $request, InventoryService $service)
    {
        $this->authorize('viewAny', Item::class);

        $filters = [
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
            'category_id' => $request->filled('category_id') ? $request->integer('category_id') : null,
            'is_active' => $request->has('is_active') ? $request->boolean('is_active') : null,
            'branch_id' => $request->filled('branch_id') ? $request->integer('branch_id') : null,
        ];

        $filters = array_filter($filters, fn ($value) => $value !== null);

        return ItemResource::collection($service->itemsQuery($filters)->paginate($this->perPage($request)))
            ->additional(['counts' => $service->itemStatusCounts($filters)]);
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
