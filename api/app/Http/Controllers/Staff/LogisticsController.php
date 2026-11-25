<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Logistics\ConfirmDeliveryRequest;
use App\Http\Requests\Staff\Logistics\DeliveryHistoryRequest;
use App\Http\Resources\Logistics\DeliveryHistoryResource;
use App\Http\Resources\Logistics\IncomingOrderResource;
use App\Http\Resources\Logistics\ReadyToDeliverResource;
use App\Models\ClientOrderForm;
use App\Models\Delivery;
use App\Services\DeliveryService;
use App\Services\LogisticsQueueService;
use Illuminate\Http\Request;

class LogisticsController extends Controller
{
    public function incomingOrders(Request $request, LogisticsQueueService $queue)
    {
        $this->authorize('viewLogistics', ClientOrderForm::class);

        return IncomingOrderResource::collection($queue->incomingOrders()->paginate($this->perPage($request)));
    }

    public function readyToDeliver(Request $request, LogisticsQueueService $queue)
    {
        $this->authorize('viewLogistics', ClientOrderForm::class);

        return ReadyToDeliverResource::collection($queue->readyToDeliver()->paginate($this->perPage($request)));
    }

    public function confirm(ConfirmDeliveryRequest $request, ClientOrderForm $clientOrderForm, DeliveryService $deliveries)
    {
        $this->authorize('confirmDelivery', $clientOrderForm);

        $delivery = $deliveries->confirm($clientOrderForm, $request->validated(), $request->user('staff')->employee, $this->currentBranchId());

        return new DeliveryHistoryResource($delivery->load(['clientOrderForm.client.user', 'confirmedBy.user']));
    }

    public function deliveryHistory(DeliveryHistoryRequest $request, LogisticsQueueService $queue)
    {
        $this->authorize('viewAny', Delivery::class);

        return DeliveryHistoryResource::collection(
            $queue->deliveryHistory($request->validated('from'), $request->validated('to'))->paginate($this->perPage($request)),
        );
    }

    public function summary(LogisticsQueueService $queue)
    {
        $this->authorize('viewLogistics', ClientOrderForm::class);

        return response()->json($queue->summary());
    }
}
