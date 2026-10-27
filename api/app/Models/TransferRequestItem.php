<?php

namespace App\Models;

use App\Contracts\FulfillableLine;
use App\Contracts\ReceivableLine;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['transfer_request_id', 'item_id', 'quantity_requested', 'quantity_picked', 'quantity_received'])]
class TransferRequestItem extends Model implements FulfillableLine, ReceivableLine
{
    use HasFactory;

    protected $attributes = [
        'quantity_picked' => 0,
        'quantity_received' => 0,
    ];

    public function transferRequest(): BelongsTo
    {
        return $this->belongsTo(TransferRequest::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function requestedQuantity(): int
    {
        return $this->quantity_requested;
    }

    public function expectedReceiptQuantity(): int
    {
        return $this->quantity_picked;
    }
}
