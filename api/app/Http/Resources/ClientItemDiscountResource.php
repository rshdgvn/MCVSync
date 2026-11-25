<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientItemDiscountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client' => new ClientResource($this->whenLoaded('client')),
            'item' => new ItemResource($this->whenLoaded('item')),
            'discount_percent' => (float) $this->discount_percent,
            'set_by' => $this->whenLoaded('setBy', fn () => $this->setBy?->user->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
