<?php

namespace App\Models;

use App\Contracts\ReceivableLine;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['purchase_order_id', 'item_id', 'quantity_ordered', 'quantity_received', 'unit_cost', 'discount', 'total'])]
class PurchaseOrderItem extends Model implements ReceivableLine
{
    use HasFactory;

    /**
     * quantity_received defaults to 0 at the DB level, but Eloquent's
     * create() doesn't re-read DB defaults back into the in-memory model
     * afterward — without this, a line created without explicitly passing
     * quantity_received would correctly persist 0 but return null for it
     * in that same response.
     */
    protected $attributes = [
        'quantity_received' => 0,
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function expectedReceiptQuantity(): int
    {
        return $this->quantity_ordered;
    }
}
