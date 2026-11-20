<?php

namespace App\Http\Resources\Logistics;

use App\Services\LogisticsQueueService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReadyToDeliverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $queue = app(LogisticsQueueService::class);
        $daysInQueue = $queue->daysInQueue($this->resource);

        return [
            'id' => $this->id,
            'cof_number' => $this->cof_number,
            'dr_number' => $this->dr_number,
            'client_name' => $this->client->user->name,
            'delivery_address' => $this->client->address,
            'order_total' => (float) ($this->items_sum_total ?? 0),
            'ready_for_delivery_at' => $this->ready_for_delivery_at?->toIso8601String(),
            'days_in_queue' => $daysInQueue,
            'is_aging' => $queue->isAging($daysInQueue),
        ];
    }
}
