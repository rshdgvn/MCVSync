<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Sales\StoreClientRequest;
use App\Http\Requests\Staff\Sales\UpdateClientRequest;
use App\Http\Resources\ClientOrderFormResource;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Services\ClientService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function index(Request $request, ClientService $service)
    {
        $this->authorize('viewAny', Client::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'zone_id' => ['nullable', 'integer'],
            'client_type' => ['nullable', Rule::in(['direct', 'reseller'])],
        ]);

        return ClientResource::collection($service->listQuery(array_filter($filters))->paginate($this->perPage($request)));
    }

    public function show(int $client, ClientService $service)
    {
        $this->authorize('viewAny', Client::class);

        return new ClientResource($service->visibleQuery()->findOrFail($client));
    }

    public function store(StoreClientRequest $request, ClientService $service)
    {
        $this->authorize('create', Client::class);

        return (new ClientResource($service->create($request->validated(), $request->user('staff')->employee)))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateClientRequest $request, int $client, ClientService $service)
    {
        $this->authorize('update', Client::class);

        return new ClientResource($service->update($service->visibleQuery()->findOrFail($client), $request->validated()));
    }

    public function orders(Request $request, int $client, ClientService $service)
    {
        $this->authorize('viewAny', Client::class);
        $this->authorize('viewAny', ClientOrderForm::class);

        $visible = $service->visibleQuery()->findOrFail($client);

        return ClientOrderFormResource::collection(
            ClientOrderForm::query()
                ->where('client_id', $visible->id)
                ->with(['branch'])
                ->withCount('items')
                ->withSum('items', 'total')
                ->latest()
                ->orderByDesc('id')
                ->paginate($this->perPage($request)),
        );
    }

    public function insights(int $client, ClientService $service)
    {
        $this->authorize('viewAny', Client::class);

        return response()->json($service->insights($service->visibleQuery()->findOrFail($client)));
    }
}
