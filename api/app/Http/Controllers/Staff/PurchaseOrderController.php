<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StorePurchaseOrderRequest;
use App\Http\Requests\Staff\UpdatePurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function index(Request $request, PurchaseOrderService $service)
    {
        $this->authorize('viewAny', PurchaseOrder::class);

        $filters = array_filter([
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
            'status' => $request->filled('status') ? (string) $request->string('status') : null,
            'supplier_id' => $request->filled('supplier_id') ? $request->integer('supplier_id') : null,
            'branch_id' => $request->filled('branch_id') ? $request->integer('branch_id') : null,
        ], fn ($value) => $value !== null);

        return PurchaseOrderResource::collection($service->listQuery($filters)->paginate($this->perPage($request)))
            ->additional(['counts' => $service->statusCounts($filters)]);
    }

    public function store(StorePurchaseOrderRequest $request, PurchaseOrderService $service)
    {
        $this->authorize('create', PurchaseOrder::class);

        $data = $request->validated();
        $items = $data['items'];
        unset($data['items']);

        $purchaseOrder = $service->create($data, $items, $request->user('staff')->employee);

        return (new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user', 'items.item.category', 'items.item.unit'])))
            ->response()
            ->setStatusCode(201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        $this->authorize('view', $purchaseOrder);

        return new PurchaseOrderResource(
            $purchaseOrder->load(['supplier', 'branch', 'preparedBy.user', 'items.item.category', 'items.item.unit']),
        );
    }

    public function update(UpdatePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $purchaseOrder = $service->updateHeader($purchaseOrder, $request->validated());

        return new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user']));
    }

    public function markReady(PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $purchaseOrder = $service->markReady($purchaseOrder);

        return new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user']));
    }

    public function cancel(PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $purchaseOrder = $service->cancel($purchaseOrder);

        return new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user']));
    }
}
