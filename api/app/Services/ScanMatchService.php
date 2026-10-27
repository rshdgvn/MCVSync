<?php

namespace App\Services;

use App\Models\Item;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

class ScanMatchService
{
    public function findItem(?string $barcode, ?int $itemId): Item
    {
        $item = $itemId ? Item::find($itemId) : Item::where('barcode', $barcode)->first();

        if (! $item) {
            throw ValidationException::withMessages([
                'barcode' => 'No item matches this barcode.',
            ]);
        }

        return $item;
    }

    public function lineFor(HasMany $lines, Item $item): ?Model
    {
        return $lines->where('item_id', $item->id)->first();
    }
}
