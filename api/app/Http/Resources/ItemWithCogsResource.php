<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * Extends ItemResource rather than duplicating its fields — used only by
 * the two cogs-aware endpoints (ItemController@show and the pricing
 * items reference list), so every other ItemResource consumer (the items
 * list, batches, PO lines) doesn't gain a cogs field it never asked for.
 * Expects the controller to have set ->cogs on the underlying Item
 * before resourcing it.
 */
class ItemWithCogsResource extends ItemResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'cogs' => $this->cogs !== null ? (float) $this->cogs : null,
        ];
    }
}
