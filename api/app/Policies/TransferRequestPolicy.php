<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesInventoryAccess;

class TransferRequestPolicy
{
    use AuthorizesInventoryAccess;
}
