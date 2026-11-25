<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cof_number' => $this->clientOrderForm->cof_number,
            'client_name' => $this->clientOrderForm->client->user->name,
            'delivery_date' => $this->delivery_date->toDateString(),
            'received_by' => $this->received_by,
            'confirmed_by' => $this->confirmedBy?->user->name,
        ];
    }
}
