<?php

namespace App\Policies;

use App\Models\User;

class DeliveryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo('delivery_history.view', 'staff');
    }
}
