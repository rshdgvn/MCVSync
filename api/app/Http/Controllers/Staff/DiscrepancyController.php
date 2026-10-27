<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Resources\DiscrepancyResource;
use App\Models\Discrepancy;
use App\Models\PurchaseOrder;
use App\Models\TransferRequest;
use App\Services\DiscrepancyService;

class DiscrepancyController extends Controller
{
    public function index(PurchaseOrder $purchaseOrder, DiscrepancyService $service)
    {
        $this->authorize('view', $purchaseOrder);

        return DiscrepancyResource::collection($service->forDocument($purchaseOrder));
    }

    public function transferIndex(TransferRequest $transferRequest, DiscrepancyService $service)
    {
        $this->authorize('view', $transferRequest);

        return DiscrepancyResource::collection($service->forDocument($transferRequest));
    }

    public function resolve(Discrepancy $discrepancy, DiscrepancyService $service)
    {
        $this->authorize('update', $discrepancy);

        $discrepancy = $service->resolve($discrepancy, request()->user('staff')->employee, $this->currentBranchId());

        return new DiscrepancyResource($discrepancy->load(DiscrepancyService::RELATIONS));
    }
}
