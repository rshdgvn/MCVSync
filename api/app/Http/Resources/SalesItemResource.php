<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku,
            'category' => $this->category ? ['id' => $this->category->id, 'name' => $this->category->name] : null,
            'unit' => $this->unit ? ['id' => $this->unit->id, 'code' => $this->unit->code, 'name' => $this->unit->name] : null,
        ];
    }
}
