<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ApprovePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function pending(Request $request, PaymentService $payments)
    {
        $this->authorize('viewAny', Payment::class);

        $due = Payment::query()
            ->where('status', 'payment_due')
            ->orderBy('expected_payment_date')
            ->paginate($this->perPage($request));

        $due->getCollection()->each(fn (Payment $payment) => $payment->setAttribute('days_overdue', $payments->daysOverdue($payment)));

        return PaymentResource::collection($due);
    }

    public function approve(ApprovePaymentRequest $request, Payment $payment, PaymentService $payments)
    {
        $this->authorize('update', Payment::class);

        $payment = $payments->approve($payment, $request->validated(), $request->user('staff')->employee);

        return new PaymentResource($payment->load('approvedBy.user'));
    }

    public function history(Request $request)
    {
        $this->authorize('viewAny', Payment::class);

        $paid = Payment::query()
            ->where('status', 'paid')
            ->with('approvedBy.user')
            ->orderByDesc('approved_at')
            ->paginate($this->perPage($request));

        return PaymentResource::collection($paid);
    }
}
