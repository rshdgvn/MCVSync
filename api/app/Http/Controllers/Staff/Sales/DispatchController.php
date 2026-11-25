<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Sales\ApproveDispatchRequest;
use App\Http\Requests\Staff\Sales\HoldDispatchRequest;
use App\Http\Resources\ClientOrderFormResource;
use App\Models\ClientOrderForm;
use App\Services\ClientOrderFormService;
use Illuminate\Http\Request;

class DispatchController extends Controller
{
    public function queue(Request $request, ClientOrderFormService $service)
    {
        $this->authorize('approveDispatch', ClientOrderForm::class);

        return ClientOrderFormResource::collection($service->dispatchQueue()->paginate($this->perPage($request)));
    }

    public function approve(ApproveDispatchRequest $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service)
    {
        $this->authorize('approveDispatch', $clientOrderForm);

        $cof = $service->approveDispatch($clientOrderForm, $request->user('staff')->employee, $request->validated('note'));

        return new ClientOrderFormResource($cof->load(ClientOrderFormService::DETAIL_RELATIONS));
    }

    public function hold(HoldDispatchRequest $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service)
    {
        $this->authorize('approveDispatch', $clientOrderForm);

        $cof = $service->holdDispatch($clientOrderForm, $request->user('staff')->employee, $request->validated('note'));

        return new ClientOrderFormResource($cof->load(ClientOrderFormService::DETAIL_RELATIONS));
    }
}
