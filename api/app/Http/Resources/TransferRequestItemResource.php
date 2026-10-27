<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransferRequestItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'item' => new ItemResource($this->whenLoaded('item')),
            'quantity_requested' => $this->quantity_requested,
            'quantity_picked' => $this->quantity_picked,
            'quantity_received' => $this->quantity_received,
        ];
    }
}
