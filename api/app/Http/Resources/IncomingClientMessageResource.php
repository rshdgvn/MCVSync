<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncomingClientMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client' => new ClientResource($this->whenLoaded('client')),
            'channel' => $this->channel,
            'attachment_name' => $this->attachment_name,
            'notes' => $this->notes,
            'received_at' => $this->received_at?->toIso8601String(),
            'status' => $this->status,
            'converted_cof_id' => $this->converted_cof_id,
            'converted_cof_number' => $this->whenLoaded('convertedCof', fn () => $this->convertedCof?->cof_number),
            'logged_by' => $this->whenLoaded('loggedBy', fn () => $this->loggedBy?->user->name),
        ];
    }
}
