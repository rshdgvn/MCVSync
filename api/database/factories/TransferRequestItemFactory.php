<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\TransferRequest;
use App\Models\TransferRequestItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class TransferRequestItemFactory extends Factory
{
    protected $model = TransferRequestItem::class;

    public function definition(): array
    {
        return [
            'transfer_request_id' => TransferRequest::factory(),
            'item_id' => Item::factory(),
            'quantity_requested' => fake()->numberBetween(1, 20),
            'quantity_picked' => 0,
            'quantity_received' => 0,
        ];
    }
}
