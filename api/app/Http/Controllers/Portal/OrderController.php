<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReportIssueRequest;
use App\Http\Requests\Portal\SubmitOrderRequest;
use App\Http\Resources\Portal\OrderResource;
use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Services\ClientOrderFormService;
use App\Services\ClientSubmissionService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    private const DETAIL_RELATIONS = ['items.item.category', 'items.item.unit', 'payments'];

    public function index(Request $request)
    {
        return OrderResource::collection(
            ClientOrderForm::query()
                ->where('client_id', $this->client($request)->id)
                ->with('payments')
                ->withCount('items')
                ->withSum('items', 'total')
                ->latest()
                ->orderByDesc('id')
                ->paginate($this->perPage($request)),
        );
    }

    public function store(SubmitOrderRequest $request, ClientSubmissionService $submissions)
    {
        $cof = $submissions->submit($this->client($request), $request->validated('items'), $request->validated('notes'));

        return (new OrderResource($cof->load(self::DETAIL_RELATIONS)))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $order)
    {
        return new OrderResource($this->order($request, $order)->load(self::DETAIL_RELATIONS));
    }

    public function confirm(Request $request, int $order, ClientOrderFormService $service)
    {
        return $this->respond($service->confirmReceipt($this->order($request, $order)));
    }

    public function reportIssue(ReportIssueRequest $request, int $order, ClientOrderFormService $service)
    {
        return $this->respond($service->reportIssue($this->order($request, $order), $request->validated('description')));
    }

    public function cancel(Request $request, int $order, ClientOrderFormService $service)
    {
        return $this->respond($service->cancel($this->order($request, $order)));
    }

    public function requestCancellation(Request $request, int $order, ClientOrderFormService $service)
    {
        return $this->respond($service->requestCancellation($this->order($request, $order)));
    }

    public function resubmit(SubmitOrderRequest $request, int $order, ClientOrderFormService $service)
    {
        return $this->respond($service->resubmit($this->order($request, $order), $request->validated('items'), $request->validated('notes')));
    }

    private function respond(ClientOrderForm $cof): OrderResource
    {
        return new OrderResource($cof->load(self::DETAIL_RELATIONS));
    }

    private function order(Request $request, int $order): ClientOrderForm
    {
        return ClientOrderForm::query()
            ->withoutGlobalScopes()
            ->where('client_id', $this->client($request)->id)
            ->findOrFail($order);
    }

    private function client(Request $request): Client
    {
        return Client::query()->where('user_id', $request->user('client')->id)->firstOrFail();
    }
}
