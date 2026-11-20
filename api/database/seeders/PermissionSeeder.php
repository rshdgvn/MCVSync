<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    /**
     * Starter permission set per role — no functional-requirements doc exists
     * yet for the other modules, so this is a placeholder inferred from the
     * README's role descriptions and the spec's example permission names.
     * Fully editable later through the Admin role_permission screen; not
     * meant to be exhaustive.
     */
    public const ROLE_PERMISSIONS = [
        'sales' => ['cof.create', 'cof.view', 'cof.forward_to_purchasing', 'cof.approve_dispatch', 'cof.confirm_cancellation', 'discount.set', 'client.view', 'client.manage'],
        'purchasing' => ['purchase_order.create', 'purchase_order.approve', 'stock.receive', 'transfer.approve', 'discrepancy.resolve', 'cof.confirm_cancellation'],
        'accounting' => ['pricing.set', 'invoice.create', 'payment.record', 'cof.view'],
        'logistics' => ['dispatch.approve', 'transfer.request', 'transfer.fulfill'],
        'admin' => ['user.manage', 'role_permission.edit', 'branch.manage', 'system.configure', 'transfer.approve', 'discrepancy.resolve', 'cof.view'],
        'super_admin' => ['employee_role.assign'],
    ];

    public function run(): void
    {
        collect(self::ROLE_PERMISSIONS)
            ->flatten()
            ->unique()
            ->each(fn (string $name) => Permission::updateOrCreate(['name' => $name, 'guard_name' => 'staff']));
    }
}
