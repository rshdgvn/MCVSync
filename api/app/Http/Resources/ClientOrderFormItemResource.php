<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientOrderFormItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'item' => new ItemResource($this->whenLoaded('item')),
            'quantity' => $this->quantity,
            'quantity_picked' => $this->quantity_picked,
            'unit_cost' => $this->unit_cost !== null ? (float) $this->unit_cost : null,
            'suggested_unit_cost' => $this->when(
                array_key_exists('suggested_unit_cost', $this->resource->getAttributes()),
                fn () => $this->suggested_unit_cost,
            ),
            'discount_percent' => (float) $this->discount_percent,
            'total' => $this->total !== null ? (float) $this->total : null,
            'differs_from_request' => $this->differs_from_request,
            'differs_from_request_reason' => $this->differs_from_request_reason,
        ];
    }
}
