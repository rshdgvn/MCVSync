<?php

namespace App\Policies\Concerns;

use App\Models\User;

/**
 * This access split is fixed system architecture, not something Admin can
 * reconfigure through the dynamic role_permission screen — so this checks
 * role membership directly rather than a permission name. Shared by every
 * inventory-adjacent policy (Items, Suppliers, ...) that uses this same
 * split, so it's defined exactly once.
 *
 * Purchasing, Admin, and Super Admin get identical full read/write access;
 * Sales, Accounting, and Logistics are blocked entirely. Every ability
 * delegates to the same check since there is no read/write split within
 * the allowed roles.
 */
trait AuthorizesInventoryAccess
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(['purchasing', 'admin', 'super_admin'], 'staff');
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function delete(User $user): bool
    {
        return $this->viewAny($user);
    }
}
