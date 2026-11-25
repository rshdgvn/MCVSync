<?php

namespace App\Policies;

use App\Models\User;

class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo('client.view', 'staff');
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->checkPermissionTo('client.manage', 'staff');
    }

    public function update(User $user): bool
    {
        return $this->create($user);
    }

    public function setDiscount(User $user): bool
    {
        return $user->checkPermissionTo('discount.set', 'staff');
    }
}
