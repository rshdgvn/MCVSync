<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncomingOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cof_number' => $this->cof_number,
            'client_name' => $this->client->user->name,
            'order_status' => $this->order_status,
            'request_delivery_date' => $this->request_delivery_date?->toDateString(),
        ];
    }
}
