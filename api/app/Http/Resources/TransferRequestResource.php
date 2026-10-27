<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransferRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'transfer_number' => $this->transfer_number,
            'status' => $this->status,
            'requesting_branch' => new BranchResource($this->whenLoaded('requestingBranch')),
            'fulfilling_branch' => new BranchResource($this->whenLoaded('fulfillingBranch')),
            'requested_by' => $this->whenLoaded('requestedBy', fn () => $this->requestedBy->user->name),
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'received_at' => $this->received_at?->toIso8601String(),
            'remarks' => $this->remarks,
            'created_at' => $this->created_at?->toIso8601String(),
            'items' => TransferRequestItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
