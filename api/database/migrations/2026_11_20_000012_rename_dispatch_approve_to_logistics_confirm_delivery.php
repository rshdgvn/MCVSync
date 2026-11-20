<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const OLD_NAME = 'dispatch.approve';

    private const NEW_NAME = 'logistics.confirm_delivery';

    private const GUARD = 'staff';

    private const ROLES = ['logistics', 'super_admin'];

    public function up(): void
    {
        $this->rename(self::OLD_NAME, self::NEW_NAME);

        $permission = Permission::firstOrCreate(['name' => self::NEW_NAME, 'guard_name' => self::GUARD]);

        Role::where('guard_name', self::GUARD)
            ->whereIn('name', self::ROLES)
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($permission));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $this->rename(self::NEW_NAME, self::OLD_NAME);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function rename(string $from, string $to): void
    {
        $taken = Permission::where('name', $to)->where('guard_name', self::GUARD)->exists();

        if (! $taken) {
            Permission::where('name', $from)->where('guard_name', self::GUARD)->update(['name' => $to]);
        }
    }
};
