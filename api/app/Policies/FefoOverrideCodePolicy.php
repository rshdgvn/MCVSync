<?php

namespace App\Policies;

use App\Models\User;

class FefoOverrideCodePolicy
{
    public function create(User $user): bool
    {
        return $user->hasRole('super_admin', 'staff');
    }
}
