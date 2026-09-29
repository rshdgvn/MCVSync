<?php

namespace App\Policies;

use App\Models\User;

/**
 * Not the shared AuthorizesInventoryAccess trait — this module's split is
 * genuinely different (Sales reads, Purchasing is blocked entirely, the
 * opposite of the inventory-adjacent modules), so forcing a shared trait
 * would need per-consumer parameterization for a total of two policies,
 * which isn't worth it.
 */
class ClientItemPricePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(['accounting', 'sales', 'admin', 'super_admin'], 'staff');
    }

    public function create(User $user): bool
    {
        return $user->hasRole(['accounting', 'super_admin'], 'staff');
    }
}
