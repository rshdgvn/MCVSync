<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ConfirmTransferReceivingRequest;
use App\Http\Requests\Staff\LogTransferDiscrepancyRequest;
use App\Http\Requests\Staff\MatchScanRequest;
use App\Http\Resources\DiscrepancyResource;
use App\Http\Resources\ItemResource;
use App\Http\Resources\TransferRequestItemResource;
use App\Http\Resources\TransferRequestResource;
use App\Models\TransferRequest;
use App\Services\DiscrepancyService;
use App\Services\ReceivingService;
use App\Services\TransferService;

class TransferReceivingController extends Controller
{
    public function match(MatchScanRequest $request, TransferRequest $transferRequest, ReceivingService $service)
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
        ]);
    }

    public function confirm(ConfirmTransferReceivingRequest $request, TransferRequest $transferRequest, ReceivingService $service)
    {
        $this->authorize('update', $transferRequest);

        $line = $service->confirm(
            $transferRequest,
            $request->lineId(),
            $request->validated(),
            $request->user('staff')->employee,
            $this->currentBranchId(),
        );

        return new TransferRequestItemResource($line->load(['item.category', 'item.unit']));
    }

    public function discrepancy(LogTransferDiscrepancyRequest $request, TransferRequest $transferRequest, ReceivingService $service)
    {
        $this->authorize('update', $transferRequest);

        $discrepancy = $service->logDiscrepancy($transferRequest, $request->discrepancyData(), $this->currentBranchId());

        return (new DiscrepancyResource($discrepancy->load(DiscrepancyService::RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function complete(TransferRequest $transferRequest, ReceivingService $service)
    {
        $this->authorize('update', $transferRequest);

        $transfer = $service->complete($transferRequest, $this->currentBranchId());

        return new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS));
    }
}
