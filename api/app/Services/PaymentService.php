<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Payment;
use App\Support\BusinessDate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    /**
     * Not called by anything in this pass — the Sales module calls this
     * once it marks a Client Order Form complete/delivered, handing this
     * service the three snapshot values it needs. Built now so that hook
     * is ready the moment Sales needs it, the same way FulfillmentService
     * was built generic before Transfers became its first real caller.
     */
    public function createForOrder(
        string $referenceType,
        int $referenceId,
        float $orderTotal,
        string $paymentTerms,
        ?string $expectedPaymentDate,
    ): Payment {
        return Payment::create([
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'order_total' => $orderTotal,
            'payment_terms' => $paymentTerms,
            'expected_payment_date' => $expectedPaymentDate,
            'status' => 'payment_due',
        ]);
    }

    public function approve(Payment $payment, array $data, Employee $approvedBy): Payment
    {
        return DB::transaction(function () use ($payment, $data, $approvedBy) {
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($locked->status === 'paid') {
                throw ValidationException::withMessages([
                    'status' => 'This payment has already been approved.',
                ]);
            }

            $locked->update([
                'status' => 'paid',
                'method' => $data['method'],
                'date_received' => $data['date_received'],
                'reference_note' => $data['reference_note'] ?? null,
                'approved_by' => $approvedBy->id,
                'approved_at' => now(),
            ]);

            return $locked;
        });
    }

    public function pendingSummary(): array
    {
        $totals = Payment::query()
            ->where('status', 'payment_due')
            ->toBase()
            ->selectRaw(
                'COUNT(*) as total, SUM(CASE WHEN expected_payment_date < ? THEN 1 ELSE 0 END) as overdue',
                [BusinessDate::todayString()],
            )
            ->first();

        $total = (int) $totals->total;
        $overdue = (int) $totals->overdue;

        return ['total' => $total, 'overdue' => $overdue, 'within_terms' => $total - $overdue];
    }

    public function daysOverdue(Payment $payment): ?int
    {
        if (! $payment->expected_payment_date) {
            return null;
        }

        return max(0, -BusinessDate::daysFromToday($payment->expected_payment_date));
    }
}
