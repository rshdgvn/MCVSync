<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\DeclineTransferRequest;
use App\Http\Requests\Staff\ListTransfersRequest;
use App\Http\Requests\Staff\StoreTransferRequest;
use App\Http\Resources\TransferRequestResource;
use App\Models\TransferRequest;
use App\Services\DocumentService;
use App\Services\TransferService;
use Illuminate\Http\Request;

class TransferController extends Controller
{
    public function index(ListTransfersRequest $request, TransferService $service)
    {
        $this->authorize('viewAny', TransferRequest::class);

        $filters = $request->filters();

        return TransferRequestResource::collection($service->query($filters)->paginate($this->perPage($request)))
            ->additional(['counts' => $service->statusCounts($filters)]);
    }

    public function store(StoreTransferRequest $request, TransferService $service)
    {
        $this->authorize('create', TransferRequest::class);

        $transfer = $service->create(
            $request->safe()->except('items'),
            $request->validated('items'),
            $request->user('staff')->employee,
            $this->currentBranchId(),
        );

        return (new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(TransferRequest $transferRequest)
    {
        $this->authorize('view', $transferRequest);

        return new TransferRequestResource($transferRequest->load(TransferService::DETAIL_RELATIONS));
    }

    public function transmittalReceipt(TransferRequest $transferRequest, DocumentService $documents)
    {
        $this->authorize('view', $transferRequest);

        return $documents->transmittalReceipt($transferRequest);
    }

    public function approve(Request $request, TransferRequest $transferRequest, TransferService $service)
    {
        $this->authorize('approve', $transferRequest);

        $transfer = $service->approve($transferRequest, $request->user('staff')->employee, $this->currentBranchId());

        return new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS));
    }

    public function decline(DeclineTransferRequest $request, TransferRequest $transferRequest, TransferService $service)
    {
        $this->authorize('approve', $transferRequest);

        $transfer = $service->decline(
            $transferRequest,
            $request->user('staff')->employee,
            $this->currentBranchId(),
            $request->validated('decline_reason'),
        );

        return new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS));
    }

    public function ship(TransferRequest $transferRequest, TransferService $service)
    {
        $this->authorize('update', $transferRequest);

        $transfer = $service->ship($transferRequest, $this->currentBranchId());

        return new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS));
    }

    public function cancel(TransferRequest $transferRequest, TransferService $service)
    {
        $this->authorize('update', $transferRequest);

        $transfer = $service->cancel($transferRequest, $this->currentBranchId());

        return new TransferRequestResource($transfer->load(TransferService::DETAIL_RELATIONS));
    }
}
