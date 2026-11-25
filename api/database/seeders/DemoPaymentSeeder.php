<?php

namespace Database\Seeders;

use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\BusinessDate;
use Illuminate\Database\Seeder;

class DemoPaymentSeeder extends Seeder
{
    private const DEMO_PAYMENTS = [
        ['reference_id' => 9001, 'order_total' => 18500, 'payment_terms' => '30 Days', 'days_from_today' => -45],
        ['reference_id' => 9002, 'order_total' => 7250.5, 'payment_terms' => '15 Days', 'days_from_today' => -5],
        ['reference_id' => 9003, 'order_total' => 12000, 'payment_terms' => '30 Days', 'days_from_today' => 10],
        ['reference_id' => 9004, 'order_total' => 3400, 'payment_terms' => 'COD', 'days_from_today' => null],
    ];

    public function run(PaymentService $payments): void
    {
        if (! app()->environment('local') || Payment::query()->exists()) {
            return;
        }

        foreach (self::DEMO_PAYMENTS as $payment) {
            $payments->createForOrder(
                'client_order_form',
                $payment['reference_id'],
                $payment['order_total'],
                $payment['payment_terms'],
                $payment['days_from_today'] === null ? null : BusinessDate::today()->addDays($payment['days_from_today'])->toDateString(),
            );
        }
    }
}
