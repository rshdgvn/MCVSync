<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesInventoryAccess;

class PurchaseOrderPolicy
{
    use AuthorizesInventoryAccess;
}
