<?php

namespace App\Models\Concerns;

trait SettlesReceipt
{
    public function unsettledQuantity(): int
    {
        return max(0, $this->expectedReceiptQuantity() - $this->quantity_received - $this->short_accepted_quantity);
    }

    public function isSettled(): bool
    {
        return $this->unsettledQuantity() === 0;
    }
}
