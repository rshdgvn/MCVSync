<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StorePurchaseOrderItemRequest;
use App\Http\Requests\Staff\UpdatePurchaseOrderItemRequest;
use App\Http\Resources\PurchaseOrderItemResource;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Services\PurchaseOrderService;

class PurchaseOrderItemController extends Controller
{
    public function store(StorePurchaseOrderItemRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $item = $service->addItem($purchaseOrder, $request->validated());

        return (new PurchaseOrderItemResource($item->load(['item.category', 'item.unit'])))
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdatePurchaseOrderItemRequest $request,
        PurchaseOrder $purchaseOrder,
        PurchaseOrderItem $item,
        PurchaseOrderService $service,
    ) {
        $this->authorize('update', $purchaseOrder);
        $this->ensureLineBelongsToOrder($purchaseOrder, $item);

        $item = $service->updateItem($item, $request->validated());

        return new PurchaseOrderItemResource($item->load(['item.category', 'item.unit']));
    }

    public function destroy(PurchaseOrder $purchaseOrder, PurchaseOrderItem $item, PurchaseOrderService $service)
    {
        $this->authorize('update', $purchaseOrder);
        $this->ensureLineBelongsToOrder($purchaseOrder, $item);

        $service->removeItem($item);

        return response()->noContent();
    }

    private function ensureLineBelongsToOrder(PurchaseOrder $purchaseOrder, PurchaseOrderItem $item): void
    {
        abort_unless($item->purchase_order_id === $purchaseOrder->id, 404);
    }
}
