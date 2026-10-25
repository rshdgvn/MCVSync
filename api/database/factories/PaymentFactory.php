<?php

namespace Database\Factories;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'reference_type' => 'client_order_form',
            'reference_id' => fake()->numberBetween(1, 1000),
            'order_total' => fake()->randomFloat(2, 100, 5000),
            'payment_terms' => fake()->randomElement(['COD', '30 Days']),
            'expected_payment_date' => now()->addDays(7)->toDateString(),
            'status' => 'payment_due',
        ];
    }
}
