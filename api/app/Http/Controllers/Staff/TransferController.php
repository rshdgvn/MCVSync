<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ListTransfersRequest;
use App\Http\Requests\Staff\StoreTransferRequest;
use App\Http\Resources\TransferRequestResource;
use App\Models\TransferRequest;
use App\Services\TransferService;

class TransferController extends Controller
{
    public function index(ListTransfersRequest $request, TransferService $service)
    {
        $this->authorize('viewAny', TransferRequest::class);

        return TransferRequestResource::collection(
            $service->query($request->filters())->paginate($this->perPage($request)),
        );
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
