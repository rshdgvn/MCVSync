<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['client_order_form_id', 'delivery_date', 'received_by', 'notes', 'confirmed_by'])]
class Delivery extends Model
{
    protected function casts(): array
    {
        return [
            'delivery_date' => 'immutable_date',
        ];
    }

    public function clientOrderForm(): BelongsTo
    {
        return $this->belongsTo(ClientOrderForm::class);
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'confirmed_by');
    }
}
