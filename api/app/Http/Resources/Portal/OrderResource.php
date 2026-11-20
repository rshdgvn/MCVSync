<?php

namespace App\Http\Resources\Portal;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $payment = $this->relationLoaded('payments') ? $this->payments->sortByDesc('id')->first() : null;

        return [
            'id' => $this->id,
            'order_number' => $this->cof_number,
            'delivery_receipt_number' => $this->dr_number,
            'order_status' => $this->order_status,
            'payment_status' => $payment?->status,
            'cancellation_requested' => $this->cancellation_requested,
            'revision_reason' => $this->revision_reason,
            'terms' => $this->terms,
            'request_delivery_date' => $this->request_delivery_date?->toDateString(),
            'notes' => $this->remarks,
            'issue' => $this->issue_reported_at === null ? null : [
                'description' => $this->issue_description,
                'reported_at' => $this->issue_reported_at->toIso8601String(),
            ],
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($line) => [
                'item' => new ItemResource($line->item),
                'quantity' => $line->quantity,
                'unit_cost' => $line->unit_cost !== null ? (float) $line->unit_cost : null,
                'discount_percent' => (float) $line->discount_percent,
                'total' => $line->total !== null ? (float) $line->total : null,
            ])),
            'items_count' => $this->whenCounted('items'),
            'total' => $this->relationLoaded('items')
                ? (float) $this->items->sum(fn ($line) => (float) $line->total)
                : ($this->whenAggregated('items', 'total', 'sum', fn ($sum) => (float) $sum) ?? 0.0),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
