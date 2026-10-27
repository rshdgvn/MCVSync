<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\MatchScanRequest;
use App\Http\Requests\Staff\PickStockRequest;
use App\Http\Resources\BatchResource;
use App\Http\Resources\ItemResource;
use App\Http\Resources\TransferRequestItemResource;
use App\Models\TransferRequest;
use App\Services\FulfillmentService;

class TransferFulfillmentController extends Controller
{
    public function match(MatchScanRequest $request, TransferRequest $transferRequest, FulfillmentService $service)
    {
        $this->authorize('update', $transferRequest);

        $result = $service->match(
            $transferRequest,
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
            'transfer_request_item' => new TransferRequestItemResource($result['line']->load(['item.category', 'item.unit'])),
            'remaining_quantity' => $result['remaining_quantity'],
            'suggested_batch' => $result['suggested_batch'] ? new BatchResource($result['suggested_batch']) : null,
        ]);
    }

    public function pick(PickStockRequest $request, TransferRequest $transferRequest, FulfillmentService $service)
    {
        $this->authorize('update', $transferRequest);

        $line = $service->pick(
            $transferRequest,
            $request->validated(),
            $request->user('staff')->employee,
            $this->currentBranchId(),
        );

        return new TransferRequestItemResource($line->load(['item.category', 'item.unit']));
    }
}
