<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\MatchScanRequest;
use App\Http\Requests\Staff\PickStockRequest;
use App\Http\Resources\BatchResource;
use App\Http\Resources\ClientOrderFormFulfillmentResource;
use App\Http\Resources\ClientOrderFormItemResource;
use App\Http\Resources\ItemResource;
use App\Models\ClientOrderForm;
use App\Services\ClientOrderFormService;
use App\Services\FulfillmentService;
use Illuminate\Http\Request;

class ClientOrderFormFulfillmentController extends Controller
{
    public function queue(Request $request, ClientOrderFormService $service)
    {
        $this->authorize('fulfill', ClientOrderForm::class);

        return ClientOrderFormFulfillmentResource::collection($service->fulfillmentQueue()->paginate($this->perPage($request)));
    }

    public function show(ClientOrderForm $clientOrderForm)
    {
        $this->authorize('fulfill', $clientOrderForm);

        return new ClientOrderFormFulfillmentResource($clientOrderForm->load(['client.user', 'branch', 'items.item.unit', 'items.item.category']));
    }

    public function match(MatchScanRequest $request, ClientOrderForm $clientOrderForm, FulfillmentService $service, ClientOrderFormService $orders)
    {
        $this->authorize('fulfill', $clientOrderForm);
        $orders->assertOpenForPicking($clientOrderForm);

        $result = $service->match($clientOrderForm, $request->validated('barcode'), $request->validated('item_id'), $this->currentBranchId());

        if ($result['status'] === 'not_found') {
            return response()->json([
                'status' => 'not_found',
                'item' => new ItemResource($result['item']->load(['category', 'unit'])),
            ]);
        }

        return response()->json([
            'status' => 'found',
            'client_order_form_item' => $this->pickLine($result['line']),
            'remaining_quantity' => $result['remaining_quantity'],
            'suggested_batch' => $result['suggested_batch'] ? new BatchResource($result['suggested_batch']) : null,
        ]);
    }

    public function pick(PickStockRequest $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service)
    {
        $this->authorize('fulfill', $clientOrderForm);

        $line = $service->pick($clientOrderForm, $request->validated(), $request->user('staff')->employee, $this->currentBranchId());

        return response()->json([
            'client_order_form_item' => $this->pickLine($line),
            'order_status' => ClientOrderForm::query()->withoutGlobalScopes()->whereKey($clientOrderForm->id)->value('order_status'),
        ]);
    }

    public function complete(ClientOrderForm $clientOrderForm, ClientOrderFormService $service)
    {
        $this->authorize('fulfill', $clientOrderForm);

        $cof = $service->completePicking($clientOrderForm, $this->currentBranchId());

        return new ClientOrderFormFulfillmentResource($cof->load(['client.user', 'branch', 'items.item.unit', 'items.item.category']));
    }

    private function pickLine($line): array
    {
        $line->load(['item.category', 'item.unit']);

        return [
            'id' => $line->id,
            'item' => new ItemResource($line->item),
            'quantity' => $line->quantity,
            'quantity_picked' => $line->quantity_picked,
        ];
    }
}
