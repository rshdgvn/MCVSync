<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\Sales\StoreIncomingMessageRequest;
use App\Http\Resources\IncomingClientMessageResource;
use App\Models\ClientOrderForm;
use App\Models\IncomingClientMessage;
use App\Services\ClientService;
use App\Services\IncomingMessageService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IncomingMessageController extends Controller
{
    public function index(Request $request, IncomingMessageService $service)
    {
        $this->authorize('create', ClientOrderForm::class);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['received', 'converted'])],
            'client_id' => ['nullable', 'integer'],
        ]);

        return IncomingClientMessageResource::collection(
            $service->listQuery($filters['status'] ?? null, isset($filters['client_id']) ? (int) $filters['client_id'] : null)
                ->paginate($this->perPage($request)),
        );
    }

    public function store(StoreIncomingMessageRequest $request, IncomingMessageService $service, ClientService $clients)
    {
        $this->authorize('create', ClientOrderForm::class);

        $message = $service->log(
            $clients->visibleQuery()->findOrFail($request->validated('client_id')),
            $request->validated('channel'),
            $request->file('attachment'),
            $request->validated('received_at'),
            $request->validated('notes'),
            $request->user('staff')->employee,
        );

        return (new IncomingClientMessageResource($message->load(['client.user', 'loggedBy.user'])))->response()->setStatusCode(201);
    }

    public function attachment(IncomingClientMessage $incomingClientMessage, IncomingMessageService $service)
    {
        $this->authorize('view', ClientOrderForm::class);

        return $service->download($incomingClientMessage);
    }
}
