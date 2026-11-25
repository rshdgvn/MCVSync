<?php

namespace App\Policies;

use App\Models\User;
use App\Policies\Concerns\AuthorizesInventoryAccess;

class ClientOrderFormPolicy
{
    use AuthorizesInventoryAccess {
        viewAny as hasInventoryAccess;
    }

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'cof.view');
    }

    public function view(User $user): bool
    {
        return $this->allows($user, 'cof.view');
    }

    public function create(User $user): bool
    {
        return $this->allows($user, 'cof.create');
    }

    public function update(User $user): bool
    {
        return $this->allows($user, 'cof.create');
    }

    public function forward(User $user): bool
    {
        return $this->allows($user, 'cof.forward_to_purchasing');
    }

    public function approveDispatch(User $user): bool
    {
        return $this->allows($user, 'cof.approve_dispatch');
    }

    public function confirmCancellation(User $user): bool
    {
        return $this->allows($user, 'cof.confirm_cancellation');
    }

    public function fulfill(User $user): bool
    {
        return $this->hasInventoryAccess($user);
    }

    public function viewLogistics(User $user): bool
    {
        return $this->allows($user, 'logistics.view');
    }

    public function confirmDelivery(User $user): bool
    {
        return $this->allows($user, 'logistics.confirm_delivery');
    }

    public function printDeliveryReceipt(User $user): bool
    {
        return $this->allows($user, 'cof.view') || $this->hasInventoryAccess($user);
    }

    private function allows(User $user, string $permission): bool
    {
        return $user->checkPermissionTo($permission, 'staff');
    }
}
