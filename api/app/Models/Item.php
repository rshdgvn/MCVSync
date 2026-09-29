<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'sku',
    'barcode',
    'category_id',
    'unit_id',
    'description',
    'has_expiry',
    'expiry_alert_threshold_days',
    'reorder_point',
    'reorder_quantity',
    'is_active',
])]
class Item extends Model
{
    use HasFactory;

    /**
     * Eloquent's create() does not re-read DB-level column defaults back
     * into the in-memory model after insert — without these, a create
     * request that omits has_expiry/is_active would correctly persist
     * `true` to the database but return `null` for both in that same
     * response, even though the column default is true.
     */
    protected $attributes = [
        'has_expiry' => true,
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'has_expiry' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function stockTransactions(): HasMany
    {
        return $this->hasMany(StockTransaction::class);
    }

    public function stockReservations(): HasMany
    {
        return $this->hasMany(StockReservation::class);
    }
}
