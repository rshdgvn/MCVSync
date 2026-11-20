<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesExpiryAlertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'item' => ['id' => (int) $this->item_id, 'name' => $this->item_name, 'sku' => $this->sku],
            'branch' => ['id' => (int) $this->branch_id, 'name' => $this->branch_name],
            'days_remaining' => (int) $this->days_remaining,
        ];
    }
}
