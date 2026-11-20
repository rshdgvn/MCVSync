<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Client;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccountProvisioningService
{
    /**
     * The only path that creates a staff account pair. Wrapping user+employee
     * creation in one transaction is what keeps `users.type` always matching
     * which extension table actually has a row for it.
     */
    public function createStaff(array $userData, ?int $branchId, string $position): Employee
    {
        return DB::transaction(function () use ($userData, $branchId, $position) {
            $user = User::create([...$userData, 'type' => 'staff']);

            return Employee::create([
                'user_id' => $user->id,
                'branch_id' => $branchId,
                'position' => $position,
            ]);
        });
    }

    public function createClient(array $userData, array $clientData): Client
    {
        return DB::transaction(function () use ($userData, $clientData) {
            $user = User::create([...$userData, 'type' => 'client']);

            return Client::create([
                ...$clientData,
                'branch_id' => $clientData['branch_id'] ?? Branch::where('is_main', true)->value('id'),
                'user_id' => $user->id,
            ]);
        });
    }
}
