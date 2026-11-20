<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientSubmissionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'notes' => $this->notes,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($line) => [
                'item' => new ItemResource($line->item),
                'quantity' => $line->quantity,
            ])),
        ];
    }
}
