<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->user->name,
            'contact' => $this->contact,
            'address' => $this->address,
            'client_type' => $this->client_type,
            'zone' => $this->zone ? new ZoneResource($this->zone) : null,
        ];
    }
}
