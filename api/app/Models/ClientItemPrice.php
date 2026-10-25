<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only — a price change is a new row, never an edit to an existing
 * one. "Current price" is just the most recent row for a (client_id,
 * item_id) pair; full history falls out of that for free.
 */
#[Fillable(['client_id', 'item_id', 'srp', 'set_by'])]
class ClientItemPrice extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'srp' => 'decimal:2',
        ];
    }

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
