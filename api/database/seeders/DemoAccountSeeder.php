<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use App\Models\Zone;
use App\Services\AccountProvisioningService;
use App\Services\EmployeeRoleAssignmentService;
use Illuminate\Database\Seeder;

/**
 * One demo account per staff role plus one portal client. The emails are
 * fixed and publicly known, so outside local/testing it only runs when
 * SEED_DEMO_ACCOUNTS is explicitly enabled.
 */
class DemoAccountSeeder extends Seeder
{
    private const STAFF_ACCOUNTS = [
        ['role' => 'sales', 'name' => 'Sales Demo', 'branch' => 'APALIT', 'position' => 'Sales Associate', 'email' => 'sales@mcvsync.test'],
        ['role' => 'purchasing', 'name' => 'Purchasing Demo', 'branch' => 'APALIT', 'position' => 'Purchasing Manager', 'email' => 'purchasing@mcvsync.test'],
        ['role' => 'accounting', 'name' => 'Accounting Demo', 'branch' => 'APALIT', 'position' => 'Accounting Staff', 'email' => 'accounting@mcvsync.test'],
        ['role' => 'logistics', 'name' => 'Logistics Demo', 'branch' => 'APALIT', 'position' => 'Logistics Coordinator', 'email' => 'logistics@mcvsync.test'],
        ['role' => 'admin', 'name' => 'Admin Demo', 'branch' => null, 'position' => 'System Administrator', 'email' => 'admin@mcvsync.test'],
        ['role' => 'super_admin', 'name' => 'Super Admin Demo', 'branch' => null, 'position' => 'Chief Executive Officer', 'email' => 'superadmin@mcvsync.test'],
    ];

    private const CLIENT_ACCOUNT = [
        'name' => 'Client Demo',
        'email' => 'client@mcvsync.test',
        'zone' => 'Pampanga/Bulacan',
        'address' => 'San Fernando, Pampanga',
        'contact' => '09170000000',
        'client_type' => 'direct',
    ];

    public function run(
        AccountProvisioningService $provisioning,
        EmployeeRoleAssignmentService $roleAssignment,
    ): void {
        $password = config('services.seed_user_password');

        if (! $this->isEnabled() || ! $password) {
            return;
        }

        foreach (self::STAFF_ACCOUNTS as $account) {
            if (User::where('email', $account['email'])->exists()) {
                continue;
            }

            $branchId = $account['branch']
                ? Branch::where('code', $account['branch'])->value('id')
                : null;

            $employee = $provisioning->createStaff([
                'name' => $account['name'],
                'email' => $account['email'],
                'password' => $password,
            ], branchId: $branchId, position: $account['position']);

            $roleAssignment->assign($employee, $account['role']);
        }

        $client = self::CLIENT_ACCOUNT;

        if (User::where('email', $client['email'])->exists()) {
            return;
        }

        $provisioning->createClient([
            'name' => $client['name'],
            'email' => $client['email'],
            'password' => $password,
        ], [
            'zone_id' => Zone::where('name', $client['zone'])->value('id'),
            'address' => $client['address'],
            'contact' => $client['contact'],
            'client_type' => $client['client_type'],
        ]);
    }

    private function isEnabled(): bool
    {
        return app()->environment('local', 'testing') || config('services.seed_demo_accounts');
    }
}
