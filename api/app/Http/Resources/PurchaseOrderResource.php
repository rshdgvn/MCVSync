<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'po_number' => $this->po_number,
            'supplier' => new SupplierResource($this->whenLoaded('supplier')),
            'branch' => new BranchResource($this->whenLoaded('branch')),
            'status' => $this->status,
            'order_date' => $this->order_date->toDateString(),
            'request_delivery_date' => $this->request_delivery_date?->toDateString(),
            'terms' => $this->terms,
            'prepared_by' => $this->whenLoaded('preparedBy', fn () => $this->preparedBy->user->name),
            'remarks' => $this->remarks,
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'items' => PurchaseOrderItemResource::collection($this->whenLoaded('items')),
            'total' => $this->whenLoaded('items', fn () => (float) $this->items->sum('total')),
        ];
    }
}
