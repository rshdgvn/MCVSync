<?php

use App\Models\Batch;
use App\Models\Item;
use App\Models\StockReservation;
use App\Models\TransferRequest;
use App\Models\User;
use App\Policies\TransferRequestPolicy;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

function grantTransferApproval(User $user): User
{
    $permission = Permission::firstOrCreate(['name' => TransferRequestPolicy::APPROVE_PERMISSION, 'guard_name' => 'staff']);
    $user->roles()->first()->givePermissionTo($permission);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    return $user->fresh();
}

function awaitingTransfer(User $requester, User $fulfiller, array $quantitiesByItemId = []): TransferRequest
{
    $transfer = makeTransfer($requester, $fulfiller, $quantitiesByItemId ?: [Item::factory()->create()->id => 3]);
    $transfer->update(['status' => 'awaiting_approval']);

    return $transfer->fresh();
}

function activeReservationsFor(TransferRequest $transfer): int
{
    return StockReservation::withoutGlobalScopes()
        ->where('reference_type', 'transfer_request')
        ->where('reference_id', $transfer->id)
        ->where('status', 'active')
        ->count();
}

test('the main branch approves a request and it moves to pending with who and when', function () {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $transfer = awaitingTransfer(makePurchasingUser('CEBU'), $main);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")
        ->assertOk()
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('decided_by', $main->name)
        ->assertJsonPath('decline_reason', null);

    expect($transfer->fresh()->decided_at)->not->toBeNull();
});

test('the main branch declines a request with a reason and it ends there', function () {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $cebu = makePurchasingUser('CEBU');
    $transfer = awaitingTransfer($cebu, $main);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", ['decline_reason' => 'Stock is reserved for a client order.'])
        ->assertOk()
        ->assertJsonPath('status', 'declined')
        ->assertJsonPath('decline_reason', 'Stock is reserved for a client order.');

    $this->actingAs($cebu, 'staff')->getJson("/api/staff/transfers/{$transfer->id}")
        ->assertOk()
        ->assertJsonPath('decline_reason', 'Stock is reserved for a client order.')
        ->assertJsonPath('decided_by', $main->name);
});

test('a decline needs a reason of at most 500 characters', function () {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $transfer = awaitingTransfer(makePurchasingUser('CEBU'), $main);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['decline_reason' => 'Say why this request is being declined.']);
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", ['decline_reason' => str_repeat('x', 501)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('decline_reason');

    expect($transfer->fresh()->status)->toBe('awaiting_approval');
});

test('only a request awaiting approval can be approved or declined', function (string $status) {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $transfer = makeTransfer(makePurchasingUser('CEBU'), $main, [Item::factory()->create()->id => 1]);
    $transfer->update(['status' => $status]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'This request has already been decided.']);
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", ['decline_reason' => 'No.'])
        ->assertUnprocessable();

    expect($transfer->fresh()->status)->toBe($status);
})->with(['pending', 'shipped', 'closed', 'cancelled', 'declined']);

test('a second approve never transitions twice', function () {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $transfer = awaitingTransfer(makePurchasingUser('CEBU'), $main);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertOk();
    $firstDecision = $transfer->fresh()->decided_at;
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertUnprocessable();
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", ['decline_reason' => 'Too late.'])->assertUnprocessable();

    $fresh = $transfer->fresh();
    expect($fresh->status)->toBe('pending');
    expect($fresh->decided_at->equalTo($firstDecision))->toBeTrue();
    expect($fresh->decline_reason)->toBeNull();
});

test('a non-main branch user cannot approve even with the permission', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = grantTransferApproval(makePurchasingUser('CEBU'));
    $transfer = awaitingTransfer($cebu, $main);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertForbidden();
    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/decline", ['decline_reason' => 'No.'])->assertForbidden();

    expect($transfer->fresh()->status)->toBe('awaiting_approval');
});

test('a main branch user without the permission cannot approve', function () {
    $main = makePurchasingUser('APALIT');
    $transfer = awaitingTransfer(makePurchasingUser('CEBU'), $main);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertForbidden();

    expect($transfer->fresh()->status)->toBe('awaiting_approval');
});

test('roles outside inventory cannot approve even with the permission', function () {
    $main = makePurchasingUser('APALIT');
    $sales = grantTransferApproval(assignStaffRole(makeStaffUser([], 'APALIT'), 'sales'));
    $transfer = awaitingTransfer(makePurchasingUser('CEBU'), $main);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertForbidden();
});

test('admin with the permission approves from any branch', function () {
    $main = makePurchasingUser('APALIT');
    $admin = grantTransferApproval(assignStaffRole(makeStaffUser([], 'CEBU'), 'admin'));
    $transfer = awaitingTransfer(makePurchasingUser('DAVAO'), $main);

    $this->actingAs($admin, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")
        ->assertOk()
        ->assertJsonPath('status', 'pending');
});

test('the requesting branch can cancel a request while it awaits approval', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = awaitingTransfer($cebu, $main);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/cancel")
        ->assertOk()
        ->assertJsonPath('status', 'cancelled');
});

test('a declined request cannot be cancelled', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 1]);
    $transfer->update(['status' => 'declined']);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/cancel")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

test('nothing is reserved or picked before approval, and approval opens fulfillment', function () {
    $main = grantTransferApproval(makePurchasingUser('APALIT'));
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $main->employee->branch_id, 'quantity' => 10]);
    $transfer = awaitingTransfer($cebu, $main, [$item->id => 4]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $item->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])
        ->assertUnprocessable();
    expect(activeReservationsFor($transfer))->toBe(0);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/approve")->assertOk();
    expect(activeReservationsFor($transfer))->toBe(0);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])
        ->assertOk();
    expect(activeReservationsFor($transfer))->toBe(1);
});

test('a new request created through the API waits for approval', function () {
    makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');

    $this->actingAs($cebu, 'staff')->postJson('/api/staff/transfers', [
        'items' => [['item_id' => Item::factory()->create()->id, 'quantity' => 2]],
    ])->assertCreated()->assertJsonPath('status', 'awaiting_approval');
});

test('the list filters and counts awaiting approval and declined requests', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $awaiting = awaitingTransfer($cebu, $main);
    makeTransfer($cebu, $main, [Item::factory()->create()->id => 1])->update(['status' => 'declined']);

    $this->actingAs($main, 'staff')->getJson('/api/staff/transfers?status=awaiting_approval')
        ->assertOk()
        ->assertJsonPath('data.0.id', $awaiting->id)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('counts.awaiting_approval', 1)
        ->assertJsonPath('counts.declined', 1);
});

test('the approve permission is seeded for purchasing and admin', function () {
    $this->seed();

    $permissions = fn (string $role) => Spatie\Permission\Models\Role::findByName($role, 'staff')->permissions->pluck('name');

    expect($permissions('purchasing'))->toContain('transfer.approve');
    expect($permissions('admin'))->toContain('transfer.approve');
    expect($permissions('super_admin'))->toContain('transfer.approve');
    expect($permissions('sales'))->not->toContain('transfer.approve');
});

test('the grant migration adds the approve permission without touching other role permissions', function () {
    $roles = collect(['purchasing', 'admin', 'sales'])
        ->mapWithKeys(fn (string $name) => [$name => Spatie\Permission\Models\Role::findOrCreate($name, 'staff')]);
    $edited = Permission::firstOrCreate(['name' => 'cof.view', 'guard_name' => 'staff']);
    $roles['purchasing']->givePermissionTo($edited);
    Permission::where('name', TransferRequestPolicy::APPROVE_PERMISSION)->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $migration = require database_path('migrations/2026_11_19_000004_grant_transfer_approve_permission.php');
    $migration->up();
    $migration->up();

    $permissions = fn (string $role) => $roles[$role]->fresh()->permissions->pluck('name')->sort()->values()->all();

    expect($permissions('purchasing'))->toBe(['cof.view', 'transfer.approve']);
    expect($permissions('admin'))->toBe(['transfer.approve']);
    expect($permissions('sales'))->toBe([]);
    expect(Permission::where('name', TransferRequestPolicy::APPROVE_PERMISSION)->count())->toBe(1);
});
