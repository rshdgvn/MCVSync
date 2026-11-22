<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientOrderFormResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cof_number' => $this->cof_number,
            'dr_number' => $this->dr_number,
            'client' => new ClientResource($this->whenLoaded('client')),
            'branch' => new BranchResource($this->whenLoaded('branch')),
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'order_status' => $this->order_status,
            'cancellation_requested' => $this->cancellation_requested,
            'ready_for_delivery_at' => $this->ready_for_delivery_at?->toIso8601String(),
            'delivery' => $this->whenLoaded('delivery', fn () => $this->delivery === null ? null : [
                'delivery_date' => $this->delivery->delivery_date->toDateString(),
                'received_by' => $this->delivery->received_by,
            ]),
            'prepared_by' => $this->whenLoaded('preparedBy', fn () => $this->preparedBy?->user->name),
            'checked_by' => $this->whenLoaded('checkedBy', fn () => $this->checkedBy?->user->name),
            'terms' => $this->terms,
            'request_delivery_date' => $this->request_delivery_date?->toDateString(),
            'remarks' => $this->remarks,
            'revision_reason' => $this->revision_reason,
            'dispatch_hold' => $this->dispatch_held_at === null ? null : [
                'note' => $this->dispatch_hold_note,
                'held_by' => $this->relationLoaded('dispatchHeldBy') ? $this->dispatchHeldBy?->user->name : null,
                'held_at' => $this->dispatch_held_at->toIso8601String(),
            ],
            'issue' => $this->issue_reported_at === null ? null : [
                'description' => $this->issue_description,
                'reported_at' => $this->issue_reported_at->toIso8601String(),
            ],
            'items' => ClientOrderFormItemResource::collection($this->whenLoaded('items')),
            'items_count' => $this->whenCounted('items'),
            'open_discrepancies_count' => $this->whenCounted('open_discrepancies'),
            'total' => $this->relationLoaded('items')
                ? (float) $this->items->sum(fn ($line) => (float) $line->total)
                : ($this->whenAggregated('items', 'total', 'sum', fn ($sum) => (float) $sum) ?? 0.0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
