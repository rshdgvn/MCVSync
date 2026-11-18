<?php

namespace App\Policies;

use App\Models\User;
use App\Policies\Concerns\AuthorizesInventoryAccess;

class DiscrepancyPolicy
{
    use AuthorizesInventoryAccess;

    public const RESOLVE_PERMISSION = 'discrepancy.resolve';

    public function resolve(User $user): bool
    {
        return $this->viewAny($user) && $user->checkPermissionTo(self::RESOLVE_PERMISSION, 'staff');
    }
}
