<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesInventoryAccess;

class PurchaseOrderDiscrepancyPolicy
{
    use AuthorizesInventoryAccess;
}
