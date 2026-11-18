<?php

namespace App\Listeners;

use App\Events\LowStockThresholdCrossed;
use App\Services\PurchaseOrderService;
use Illuminate\Contracts\Queue\ShouldQueue;

class DraftPurchaseOrderForLowStock implements ShouldQueue
{
    public function __construct(private readonly PurchaseOrderService $purchaseOrders) {}

    public function handle(LowStockThresholdCrossed $event): void
    {
        $this->purchaseOrders->draftForLowStock($event->itemId, $event->branchId);
    }
}
