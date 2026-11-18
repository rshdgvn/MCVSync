<?php

namespace App\Contracts;

interface ReceivableLine
{
    public function expectedReceiptQuantity(): int;

    public function unsettledQuantity(): int;

    public function isSettled(): bool;
}
