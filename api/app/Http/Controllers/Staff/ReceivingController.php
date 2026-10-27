<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ConfirmReceivingRequest;
use App\Http\Requests\Staff\LogDiscrepancyRequest;
use App\Http\Requests\Staff\MatchScanRequest;
use App\Http\Resources\DiscrepancyResource;
use App\Http\Resources\ItemResource;
use App\Http\Resources\PurchaseOrderItemResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\DiscrepancyService;
use App\Services\ReceivingService;

class ReceivingController extends Controller
{
    public function show(PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('view', $purchaseOrder);

        $session = $service->sessionView($purchaseOrder);

        return response()->json([
            'purchase_order' => new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user'])),
            'lines' => PurchaseOrderItemResource::collection($session['lines']),
            'discrepancies' => DiscrepancyResource::collection($session['discrepancies']),
        ]);
    }

    public function match(MatchScanRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $result = $service->match(
            $purchaseOrder,
            $request->validated('barcode'),
            $request->validated('item_id'),
            $this->currentBranchId(),
        );

        if ($result['status'] === 'not_found') {
            return response()->json([
                'status' => 'not_found',
                'item' => new ItemResource($result['item']->load(['category', 'unit'])),
            ]);
        }

        return response()->json([
            'status' => 'found',
            'purchase_order_item' => new PurchaseOrderItemResource($result['line']->load(['item.category', 'item.unit'])),
            'remaining_quantity' => $result['remaining_quantity'],
        ]);
    }

    public function confirm(ConfirmReceivingRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $line = $service->confirm(
            $purchaseOrder,
            $request->lineId(),
            $request->validated(),
            $request->user('staff')->employee,
            $this->currentBranchId(),
        );

        return new PurchaseOrderItemResource($line->load(['item.category', 'item.unit']));
    }

    public function discrepancy(LogDiscrepancyRequest $request, PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $discrepancy = $service->logDiscrepancy($purchaseOrder, $request->discrepancyData(), $this->currentBranchId());

        return (new DiscrepancyResource($discrepancy->load(DiscrepancyService::RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function complete(PurchaseOrder $purchaseOrder, ReceivingService $service)
    {
        $this->authorize('update', $purchaseOrder);

        $purchaseOrder = $service->complete($purchaseOrder, $this->currentBranchId());

        return new PurchaseOrderResource($purchaseOrder->load(['supplier', 'branch', 'preparedBy.user', 'items.item.category', 'items.item.unit']));
    }
}
