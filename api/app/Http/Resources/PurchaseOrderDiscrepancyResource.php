<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderDiscrepancyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'purchase_order_id' => $this->purchase_order_id,
            'purchase_order_item' => $this->purchaseOrderItem ? new PurchaseOrderItemResource($this->purchaseOrderItem) : null,
            'item' => $this->item ? new ItemResource($this->item) : null,
            'type' => $this->type,
            'scanned_quantity' => $this->scanned_quantity,
            'notes' => $this->notes,
            'resolved' => $this->resolved,
            'resolved_by' => $this->resolvedBy ? $this->resolvedBy->user->name : null,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
        ];
    }
}
