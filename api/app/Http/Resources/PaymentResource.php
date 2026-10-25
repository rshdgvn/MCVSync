<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * days_overdue is only ever present when the controller has attached it
 * via PaymentService::daysOverdue() first (the /payments/pending list) —
 * omitted entirely on rows where it wasn't computed, such as history.
 */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'order_total' => (float) $this->order_total,
            'payment_terms' => $this->payment_terms,
            'expected_payment_date' => $this->expected_payment_date?->toDateString(),
            'status' => $this->status,
            'method' => $this->method,
            'date_received' => $this->date_received?->toDateString(),
            'reference_note' => $this->reference_note,
            'approved_by' => $this->whenLoaded('approvedBy', fn () => $this->approvedBy?->user->name),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'days_overdue' => $this->when(
                array_key_exists('days_overdue', $this->resource->getAttributes()),
                fn () => $this->days_overdue,
            ),
        ];
    }
}
