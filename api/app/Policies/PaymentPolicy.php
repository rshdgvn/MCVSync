<?php

namespace App\Policies;

use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(['accounting', 'admin', 'super_admin'], 'staff');
    }

    public function update(User $user): bool
    {
        return $user->hasRole(['accounting', 'super_admin'], 'staff');
    }
}
