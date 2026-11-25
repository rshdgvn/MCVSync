<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Sales\StoreClientDiscountRequest;
use App\Http\Resources\ClientItemDiscountResource;
use App\Models\Client;
use App\Services\ClientService;
use App\Services\DiscountService;
use Illuminate\Http\Request;

class ClientDiscountController extends Controller
{
    public function index(Request $request, DiscountService $service)
    {
        $this->authorize('viewAny', Client::class);

        $filters = $request->validate([
            'client_id' => ['nullable', 'integer'],
            'item_id' => ['nullable', 'integer'],
        ]);

        return ClientItemDiscountResource::collection(
            $service->currentDiscountsQuery($filters['client_id'] ?? null, $filters['item_id'] ?? null)
                ->with(['client.user', 'client.zone', 'item', 'setBy.user'])
                ->paginate($this->perPage($request)),
        );
    }

    public function history(int $client, int $item, DiscountService $service, ClientService $clients)
    {
        $this->authorize('viewAny', Client::class);

        $visible = $clients->visibleQuery()->findOrFail($client);

        return ClientItemDiscountResource::collection($service->history($visible->id, $item)->with('setBy.user')->get());
    }

    public function store(StoreClientDiscountRequest $request, DiscountService $service, ClientService $clients)
    {
        $this->authorize('setDiscount', Client::class);

        $client = $clients->visibleQuery()->findOrFail($request->validated('client_id'));
        $discount = $service->setDiscount($client->id, $request->validated('item_id'), (float) $request->validated('discount_percent'), $request->user('staff')->employee);

        return (new ClientItemDiscountResource($discount->load(['client.user', 'item', 'setBy.user'])))->response()->setStatusCode(201);
    }
}
