<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Sales\ListClientOrderFormsRequest;
use App\Http\Requests\Staff\Sales\SendForRevisionRequest;
use App\Http\Requests\Staff\Sales\StoreClientOrderFormRequest;
use App\Http\Requests\Staff\Sales\UpdateClientOrderFormRequest;
use App\Http\Resources\ClientOrderFormResource;
use App\Http\Resources\ClientSubmissionResource;
use App\Http\Resources\DiscrepancyResource;
use App\Http\Resources\IncomingClientMessageResource;
use App\Http\Resources\PaymentResource;
use App\Models\ClientOrderForm;
use App\Models\ClientSubmission;
use App\Models\IncomingClientMessage;
use App\Services\ClientOrderFormService;
use App\Services\DiscrepancyService;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientOrderFormController extends Controller
{
    public function index(ListClientOrderFormsRequest $request, ClientOrderFormService $service)
    {
        $this->authorize('viewAny', ClientOrderForm::class);

        $filters = $request->filters();

        return ClientOrderFormResource::collection($service->listQuery($filters)->paginate($this->perPage($request)))
            ->additional(['counts' => $service->statusCounts($filters)]);
    }

    public function show(ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('view', $clientOrderForm);

        return $this->detail($clientOrderForm, $service, $discrepancies);
    }

    public function store(StoreClientOrderFormRequest $request, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('create', ClientOrderForm::class);

        $cof = $service->createManual($request->validated(), $request->validated('items'), $request->user('staff')->employee);

        return $this->detail($cof, $service, $discrepancies, 201);
    }

    public function update(UpdateClientOrderFormRequest $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('update', $clientOrderForm);

        $cof = $service->update($clientOrderForm, $request->headerFields(), $request->validated('items'));

        return $this->detail($cof, $service, $discrepancies);
    }

    public function forward(Request $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('forward', $clientOrderForm);

        return $this->detail($service->forward($clientOrderForm, $request->user('staff')->employee), $service, $discrepancies);
    }

    public function sendForRevision(SendForRevisionRequest $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('update', $clientOrderForm);

        return $this->detail($service->sendForRevision($clientOrderForm, $request->validated('revision_reason')), $service, $discrepancies);
    }

    public function cancel(ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('update', $clientOrderForm);

        return $this->detail($service->cancel($clientOrderForm), $service, $discrepancies);
    }

    public function confirmCancellation(Request $request, ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('confirmCancellation', $clientOrderForm);

        return $this->detail($service->confirmCancellation($clientOrderForm, $request->user('staff')->employee), $service, $discrepancies);
    }

    public function declineCancellation(ClientOrderForm $clientOrderForm, ClientOrderFormService $service, DiscrepancyService $discrepancies)
    {
        $this->authorize('confirmCancellation', $clientOrderForm);

        return $this->detail($service->declineCancellation($clientOrderForm), $service, $discrepancies);
    }

    public function deliveryReceipt(ClientOrderForm $clientOrderForm, DocumentService $documents)
    {
        $this->authorize('printDeliveryReceipt', $clientOrderForm);

        return $documents->deliveryReceipt($clientOrderForm);
    }

    private function detail(ClientOrderForm $cof, ClientOrderFormService $service, DiscrepancyService $discrepancies, int $status = 200): JsonResponse
    {
        $cof->load(ClientOrderFormService::DETAIL_RELATIONS);

        if ($cof->order_status === 'pending_approval') {
            $suggested = $service->suggestedPrices($cof);
            $cof->items->each(fn ($line) => $line->setAttribute('suggested_unit_cost', $suggested[$line->item_id] ?? null));
        }

        $payment = $service->paymentFor($cof);

        return response()->json([
            ...(new ClientOrderFormResource($cof))->resolve(request()),
            'needs_pricing_item_ids' => $cof->order_status === 'pending_approval' ? $service->needsPricing($cof) : [],
            'source' => $cof->isFromPortal()
                ? (new ClientSubmissionResource(ClientSubmission::with('items.item')->find($cof->source_id)))->resolve(request())
                : null,
            'source_message' => $cof->isFromPortal()
                ? null
                : (new IncomingClientMessageResource(
                    IncomingClientMessage::query()->withoutGlobalScopes()->with('loggedBy.user')->find($cof->source_id),
                ))->resolve(request()),
            'discrepancies' => DiscrepancyResource::collection($discrepancies->forDocument($cof))->resolve(request()),
            'payment' => $payment ? (new PaymentResource($payment))->resolve(request()) : null,
        ], $status);
    }
}
