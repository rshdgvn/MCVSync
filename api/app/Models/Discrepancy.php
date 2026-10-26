<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'reference_type',
    'reference_id',
    'reference_item_type',
    'reference_item_id',
    'item_id',
    'type',
    'scanned_quantity',
    'notes',
    'resolved',
    'resolved_by',
    'resolved_at',
])]
class Discrepancy extends Model
{
    use HasFactory;

    protected $attributes = [
        'resolved' => false,
    ];

    protected function casts(): array
    {
        return [
            'resolved' => 'boolean',
            'resolved_at' => 'datetime',
        ];
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function referenceItem(): MorphTo
    {
        return $this->morphTo();
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'resolved_by');
    }
}
