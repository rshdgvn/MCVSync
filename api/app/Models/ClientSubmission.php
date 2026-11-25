<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['client_id', 'notes', 'submitted_at', 'converted_cof_id'])]
class ClientSubmission extends Model
{
    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ClientSubmissionItem::class);
    }

    public function convertedCof(): BelongsTo
    {
        return $this->belongsTo(ClientOrderForm::class, 'converted_cof_id');
    }
}
