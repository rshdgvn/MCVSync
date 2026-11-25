<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['client_id', 'item_id', 'discount_percent', 'set_by'])]
class ClientItemDiscount extends Model
{
    public const UPDATED_AT = null;

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function setBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'set_by');
    }
}
