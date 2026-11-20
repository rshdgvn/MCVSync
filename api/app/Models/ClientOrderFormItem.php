<?php

namespace App\Models;

use App\Contracts\FulfillableLine;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'client_order_form_id',
    'item_id',
    'quantity',
    'quantity_picked',
    'unit_cost',
    'discount_percent',
    'total',
    'differs_from_request',
    'differs_from_request_reason',
])]
class ClientOrderFormItem extends Model implements FulfillableLine
{
    protected $attributes = [
        'quantity_picked' => 0,
        'discount_percent' => 0,
        'differs_from_request' => false,
    ];

    protected function casts(): array
    {
        return [
            'differs_from_request' => 'boolean',
        ];
    }

    public function clientOrderForm(): BelongsTo
    {
        return $this->belongsTo(ClientOrderForm::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function requestedQuantity(): int
    {
        return $this->quantity;
    }

    public function lineTotal(int $quantity, float $unitCost): float
    {
        return round($quantity * $unitCost * (1 - (float) $this->discount_percent / 100), 2);
    }
}
