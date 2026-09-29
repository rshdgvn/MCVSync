<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrderItem>
 */
class PurchaseOrderItemFactory extends Factory
{
    protected $model = PurchaseOrderItem::class;

    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 50);
        $unitCost = fake()->randomFloat(2, 1, 500);
        $discount = 0;

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'item_id' => Item::factory(),
            'quantity_ordered' => $quantity,
            'quantity_received' => 0,
            'unit_cost' => $unitCost,
            'discount' => $discount,
            'total' => ($quantity * $unitCost) - $discount,
        ];
    }
}
