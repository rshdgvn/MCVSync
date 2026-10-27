<?php

namespace Database\Factories;

use App\Models\Discrepancy;
use App\Models\PurchaseOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class DiscrepancyFactory extends Factory
{
    protected $model = Discrepancy::class;

    public function definition(): array
    {
        return [
            'reference_type' => 'purchase_order',
            'reference_id' => PurchaseOrder::factory(),
            'reference_item_type' => null,
            'reference_item_id' => null,
            'item_id' => null,
            'type' => 'not_found',
            'scanned_quantity' => fake()->numberBetween(1, 20),
            'notes' => null,
            'resolved' => false,
        ];
    }
}
