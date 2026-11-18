<?php

namespace App\Policies;

use App\Models\User;
use App\Policies\Concerns\AuthorizesInventoryAccess;

class TransferRequestPolicy
{
    use AuthorizesInventoryAccess;

    public const APPROVE_PERMISSION = 'transfer.approve';

    public function approve(User $user): bool
    {
        if (! $this->viewAny($user) || ! $user->checkPermissionTo(self::APPROVE_PERMISSION, 'staff')) {
            return false;
        }

        return $user->hasRole(['admin', 'super_admin'], 'staff') || (bool) $user->employee?->branch?->is_main;
    }
}
