<?php

namespace App\Contracts;

interface FulfillableLine
{
    public function requestedQuantity(): int;
}
