<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSION = 'cof.view';

    private const GUARD = 'staff';

    private const ROLES = ['sales', 'accounting', 'admin', 'super_admin'];

    private const ADDED_ROLES = ['accounting', 'admin'];

    public function up(): void
    {
        $permission = Permission::firstOrCreate(['name' => self::PERMISSION, 'guard_name' => self::GUARD]);

        Role::where('guard_name', self::GUARD)
            ->whereIn('name', self::ROLES)
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($permission));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permission = Permission::where('name', self::PERMISSION)->where('guard_name', self::GUARD)->first();

        if ($permission !== null) {
            Role::where('guard_name', self::GUARD)
                ->whereIn('name', self::ADDED_ROLES)
                ->get()
                ->each(fn (Role $role) => $role->revokePermissionTo($permission));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
