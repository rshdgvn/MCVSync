<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DiscrepancyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'reference_item_type' => $this->reference_item_type,
            'reference_item_id' => $this->reference_item_id,
            'item' => new ItemResource($this->whenLoaded('item')),
            'type' => $this->type,
            'scanned_quantity' => $this->scanned_quantity,
            'notes' => $this->notes,
            'resolved' => $this->resolved,
            'resolved_by' => $this->whenLoaded('resolvedBy', fn () => $this->resolvedBy?->user->name),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
