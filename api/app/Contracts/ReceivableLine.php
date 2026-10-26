<?php

namespace App\Contracts;

interface ReceivableLine
{
    public function expectedReceiptQuantity(): int;
}
