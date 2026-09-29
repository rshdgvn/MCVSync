<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ConfirmReceivingRequest;
use App\Http\Requests\Staff\LogDiscrepancyRequest;
use App\Http\Requests\Staff\MatchReceivingScanRequest;
use App\Http\Resources\ItemResource;
use App\Http\Resources\PurchaseOrderDiscrepancyResource;
use App\Http\Resources\PurchaseOrderItemResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\ReceivingService;

class ReceivingController extends Controller
{
    public function show(PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('view', $purchaseOrder);

        $session = $service->sessionView($purchaseOrder);

        return response()->json([
            'purchase_order' => new PurchaseOrderResource($session['purchase_order']),
            'lines' => PurchaseOrderItemResource::collection($session['lines']),
            'discrepancies' => PurchaseOrderDiscrepancyResource::collection($session['discrepancies']),
        ]);
    }

    public function match(MatchReceivingScanRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $result = $service->match($purchaseOrder, $request->validated('barcode'), $request->validated('item_id'));

        if ($result['status'] === 'not_found_on_po') {
            return response()->json([
                'status' => 'not_found_on_po',
                'item' => new ItemResource($result['item']->load(['category', 'unit'])),
            ]);
        }

        return response()->json([
            'status' => 'found_on_po',
            'purchase_order_item' => new PurchaseOrderItemResource($result['purchase_order_item']->load(['item.category', 'item.unit'])),
            'remaining_quantity' => $result['remaining_quantity'],
        ]);
    }

    public function confirm(ConfirmReceivingRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $line = $service->confirm($purchaseOrder, $request->validated(), $request->user('staff')->employee);

        return new PurchaseOrderItemResource($line->load(['item.category', 'item.unit']));
    }

    public function discrepancy(LogDiscrepancyRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $discrepancy = $service->logDiscrepancy($purchaseOrder, $request->validated());

        return (new PurchaseOrderDiscrepancyResource($discrepancy->load(['item', 'purchaseOrderItem.item'])))
            ->response()
            ->setStatusCode(201);
    }

    public function complete(PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $purchaseOrder = $service->complete($purchaseOrder);

        return new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user', 'items.item.category', 'items.item.unit']));
    }
}
