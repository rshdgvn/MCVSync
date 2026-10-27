<?php

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Item;
use App\Models\StockReservation;
use App\Models\TransferRequest;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function makeStaffUser(array $overrides = [], string $branchCode = 'APALIT', string $position = 'Staff'): User
{
    $branch = Branch::firstOrCreate(
        ['code' => $branchCode],
        ['name' => $branchCode, 'address' => 'Test address', 'is_main' => $branchCode === 'APALIT']
    );

    $user = User::factory()->staff()->create($overrides);

    Employee::create(['user_id' => $user->id, 'branch_id' => $branch->id, 'position' => $position]);

    return $user->fresh();
}

function assignStaffRole(User $user, string $roleName): User
{
    $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'staff']);

    $user->syncRoles([$role]);

    return $user->fresh();
}

function makeClientUser(array $overrides = [], string $zoneName = 'Pampanga/Bulacan'): User
{
    $zone = Zone::firstOrCreate(['name' => $zoneName]);

    $user = User::factory()->client()->create($overrides);

    Client::create([
        'user_id' => $user->id,
        'address' => 'Test address',
        'contact' => '09171234567',
        'zone_id' => $zone->id,
        'client_type' => 'direct',
    ]);

    return $user->fresh();
}

function makePurchasingUser(string $branchCode): User
{
    return assignStaffRole(makeStaffUser([], $branchCode), 'purchasing');
}

function makeTransfer(User $requester, User $fulfiller, array $quantitiesByItemId): TransferRequest
{
    $transfer = TransferRequest::factory()->create([
        'requesting_branch_id' => $requester->employee->branch_id,
        'fulfilling_branch_id' => $fulfiller->employee->branch_id,
        'requested_by' => $requester->employee->id,
    ]);

    foreach ($quantitiesByItemId as $itemId => $quantity) {
        $transfer->items()->create(['item_id' => $itemId, 'quantity_requested' => $quantity]);
    }

    return $transfer;
}

function stockAt(User $user, Item $item, int $quantity, string $expiry, string $batchNumber): Batch
{
    return Batch::factory()->create([
        'item_id' => $item->id,
        'branch_id' => $user->employee->branch_id,
        'quantity' => $quantity,
        'expiry_date' => $expiry,
        'batch_number' => $batchNumber,
    ]);
}

function transferReservations(TransferRequest $transfer)
{
    return StockReservation::withoutGlobalScopes()
        ->where('reference_type', 'transfer_request')
        ->where('reference_id', $transfer->id);
}
