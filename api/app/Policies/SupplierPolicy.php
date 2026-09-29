<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesInventoryAccess;

class SupplierPolicy
{
    use AuthorizesInventoryAccess;
}
