<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Unlike stock_transactions, this is not append-only — a discrepancy is a
 * working item that gets resolved (Purchasing follows up with the
 * supplier, then marks it resolved), not a permanent ledger entry.
 */
#[Fillable([
    'purchase_order_id',
    'purchase_order_item_id',
    'item_id',
    'type',
    'scanned_quantity',
    'notes',
    'resolved',
    'resolved_by',
    'resolved_at',
])]
class PurchaseOrderDiscrepancy extends Model
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

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
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
