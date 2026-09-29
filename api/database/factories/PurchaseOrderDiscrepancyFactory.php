<?php

namespace Database\Factories;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDiscrepancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrderDiscrepancy>
 */
class PurchaseOrderDiscrepancyFactory extends Factory
{
    protected $model = PurchaseOrderDiscrepancy::class;

    public function definition(): array
    {
        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'purchase_order_item_id' => null,
            'item_id' => null,
            'type' => 'not_found_on_po',
            'scanned_quantity' => fake()->numberBetween(1, 20),
            'notes' => null,
            'resolved' => false,
        ];
    }
}
