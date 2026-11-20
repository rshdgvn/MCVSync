<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientOrderFormFulfillmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cof_number' => $this->cof_number,
            'client_name' => $this->whenLoaded('client', fn () => $this->client->user->name),
            'branch' => new BranchResource($this->whenLoaded('branch')),
            'order_status' => $this->order_status,
            'cancellation_requested' => $this->cancellation_requested,
            'request_delivery_date' => $this->request_delivery_date?->toDateString(),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($line) => [
                'id' => $line->id,
                'item' => new ItemResource($line->item),
                'quantity' => $line->quantity,
                'quantity_picked' => $line->quantity_picked,
            ])),
            'items_count' => $this->whenCounted('items'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
