<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\SetClientItemPriceRequest;
use App\Http\Resources\ClientItemPriceResource;
use App\Http\Resources\ItemWithCogsResource;
use App\Models\ClientItemPrice;
use App\Models\Item;
use App\Services\PricingService;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    public function items(Request $request, PricingService $pricing)
    {
        $this->authorize('viewAny', ClientItemPrice::class);

        $items = Item::query()
            ->with(['category', 'unit'])
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        $cogsByItemId = $pricing->cogsForMany($items->pluck('id')->all());

        $items->getCollection()->each(function (Item $item) use ($cogsByItemId) {
            $item->setAttribute('cogs', $cogsByItemId[$item->id] ?? null);
        });

        return ItemWithCogsResource::collection($items);
    }

    public function index(Request $request, PricingService $pricing)
    {
        $this->authorize('viewAny', ClientItemPrice::class);

        $prices = $pricing->currentPricesQuery($request->integer('client_id') ?: null, $request->integer('item_id') ?: null)
            ->with(['client.user', 'client.zone', 'item.category', 'item.unit', 'setBy.user'])
            ->paginate($this->perPage($request));

        return ClientItemPriceResource::collection($prices);
    }

    public function history(Request $request, PricingService $pricing)
    {
        $this->authorize('viewAny', ClientItemPrice::class);

        $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'item_id' => ['required', 'integer', 'exists:items,id'],
        ]);

        $history = $pricing->history($request->integer('client_id'), $request->integer('item_id'))
            ->with(['client.user', 'client.zone', 'item.category', 'item.unit', 'setBy.user'])
            ->paginate($this->perPage($request));

        return ClientItemPriceResource::collection($history);
    }

    public function zoneAverage(Request $request, PricingService $pricing)
    {
        $this->authorize('viewAny', ClientItemPrice::class);

        $request->validate([
            'item_id' => ['required', 'integer', 'exists:items,id'],
            'zone_id' => ['required', 'integer', 'exists:zones,id'],
        ]);

        $average = $pricing->zoneAverage($request->integer('item_id'), $request->integer('zone_id'));

        return response()->json(['average' => $average]);
    }

    public function store(SetClientItemPriceRequest $request, PricingService $pricing)
    {
        $this->authorize('create', ClientItemPrice::class);

        $data = $request->validated();
        $price = $pricing->setPrice($data['client_id'], $data['item_id'], $data['srp'], $request->user('staff')->employee);

        return (new ClientItemPriceResource($price->load(['client.user', 'client.zone', 'item.category', 'item.unit', 'setBy.user'])))
            ->response()
            ->setStatusCode(201);
    }
}
