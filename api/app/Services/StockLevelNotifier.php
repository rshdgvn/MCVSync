<?php

namespace App\Services;

use App\Events\LowStockThresholdCrossed;
use App\Events\StockLevelChanged;
use App\Models\Item;

class StockLevelNotifier
{
    public function __construct(private readonly StockAvailabilityService $availability) {}

    public function changed(int $itemId, int $branchId): int
    {
        $current = $this->availability->currentStock($itemId, $branchId);
        $reserved = $this->availability->reservedStock($itemId, $branchId);
        $available = $current - $reserved;

        StockLevelChanged::dispatch($itemId, $branchId, $available, $reserved, $current);

        return $available;
    }

    public function decreased(int $itemId, int $branchId, int $availableBefore): void
    {
        $availableAfter = $this->changed($itemId, $branchId);
        $reorderPoint = Item::whereKey($itemId)->value('reorder_point');

        if ($reorderPoint !== null && $availableBefore > $reorderPoint && $availableAfter <= $reorderPoint) {
            LowStockThresholdCrossed::dispatch($itemId, $branchId, $availableAfter, $reorderPoint);
        }
    }
}
