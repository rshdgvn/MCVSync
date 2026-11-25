<?php

use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\TransferRequest;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

function receivingPurchaseOrder(User $user, array $receivedByOrdered, string $status = 'ready_for_delivery'): PurchaseOrder
{
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => $status]);

    foreach ($receivedByOrdered as [$received, $ordered]) {
        $po->items()->create([
            'item_id' => Item::factory()->create()->id, 'quantity_ordered' => $ordered, 'quantity_received' => $received,
            'unit_cost' => 10, 'discount' => 0, 'total' => $ordered * 10,
        ]);
    }

    return $po;
}

function completeReceiving($test, User $user, PurchaseOrder $po)
{
    return $test->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete");
}

function shortDiscrepancyFor(PurchaseOrderItem $line): Discrepancy
{
    return Discrepancy::whereMorphedTo('referenceItem', $line)->where('type', 'short')->where('resolved', false)->firstOrFail();
}

function decide($test, User $user, Discrepancy $discrepancy, string $resolution, ?string $note = null)
{
    return $test->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", [
        'resolution' => $resolution,
        'resolution_note' => $note,
    ]);
}

test('accepting the last short line accepts the shortfall and closes the purchase order', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[5, 5], [6, 10]]);
    completeReceiving($this, $user, $po)->assertOk()->assertJsonPath('status', 'ready_for_delivery');
    $short = $po->items()->where('quantity_received', 6)->first();

    decide($this, $user, shortDiscrepancyFor($short), 'accepted', 'Supplier is out of stock.')
        ->assertOk()
        ->assertJsonPath('resolved', true)
        ->assertJsonPath('resolution', 'accepted');

    expect($short->fresh()->short_accepted_quantity)->toBe(4);
    expect($po->fresh()->status)->toBe('closed');
    $this->actingAs($user, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}")
        ->assertJsonPath('items.1.short_accepted_quantity', 4);
});

test('accepting one short line keeps the purchase order open while another line is still short', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[2, 5], [6, 10]]);
    completeReceiving($this, $user, $po);
    [$first, $second] = $po->items()->orderBy('id')->get()->all();

    decide($this, $user, shortDiscrepancyFor($first), 'accepted')->assertOk();
    expect($po->fresh()->status)->toBe('ready_for_delivery');

    decide($this, $user, shortDiscrepancyFor($second), 'accepted')->assertOk();
    expect($po->fresh()->status)->toBe('closed');
});

test('requesting a redelivery records the decision and keeps the line receivable', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10]]);
    completeReceiving($this, $user, $po);
    $line = $po->items()->first();

    decide($this, $user, shortDiscrepancyFor($line), 'redelivery_requested', 'Supplier will send the rest Friday.')
        ->assertOk()
        ->assertJsonPath('resolution', 'redelivery_requested')
        ->assertJsonPath('resolution_note', 'Supplier will send the rest Friday.');

    expect($po->fresh()->status)->toBe('ready_for_delivery');
    expect($line->fresh()->short_accepted_quantity)->toBe(0);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 4, 'batch_number' => 'REDELIVERY-1', 'expiry_date' => '2027-06-30',
    ])->assertOk();
    completeReceiving($this, $user, $po)->assertOk()->assertJsonPath('status', 'closed');
});

test('a discrepancy cannot be decided twice and the shortfall is accepted once', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10], [1, 5]]);
    completeReceiving($this, $user, $po);
    $line = $po->items()->orderBy('id')->first();
    $discrepancy = shortDiscrepancyFor($line);

    decide($this, $user, $discrepancy, 'accepted')->assertOk();
    decide($this, $user, $discrepancy, 'accepted')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['resolved' => 'This discrepancy has already been resolved.']);
    decide($this, $user, $discrepancy, 'redelivery_requested')->assertUnprocessable();

    expect($line->fresh()->short_accepted_quantity)->toBe(4);
    expect($discrepancy->fresh()->resolution)->toBe('accepted');
});

test('a decision is required and must be one of the two outcomes', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10]]);
    completeReceiving($this, $user, $po);
    $discrepancy = shortDiscrepancyFor($po->items()->first());
    $message = 'Choose whether to accept the discrepancy or request a redelivery.';

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution_note' => 'No decision'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['resolution' => $message]);
    decide($this, $user, $discrepancy, 'resolved')->assertUnprocessable()->assertJsonValidationErrors(['resolution' => $message]);

    expect($discrepancy->fresh()->resolved)->toBeFalse();
});

test('a role without the resolve permission cannot decide a discrepancy', function () {
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10]]);
    completeReceiving($this, $user, $po);
    $discrepancy = shortDiscrepancyFor($po->items()->first());

    decide($this, $user, $discrepancy, 'accepted')->assertForbidden();

    expect($discrepancy->fresh()->resolved)->toBeFalse();
    expect($po->fresh()->status)->toBe('ready_for_delivery');
});

test('a role outside inventory cannot decide a discrepancy even with the permission', function () {
    grantRolePermission('discrepancy.resolve', ['purchasing', 'sales']);
    $purchasing = makePurchasingUser('APALIT');
    $sales = assignStaffRole(makeStaffUser([], 'APALIT'), 'sales');
    $po = receivingPurchaseOrder($purchasing, [[6, 10]]);
    completeReceiving($this, $purchasing, $po);

    decide($this, $sales, shortDiscrepancyFor($po->items()->first()), 'accepted')->assertForbidden();
});

test('another branch cannot decide a discrepancy on this branch', function () {
    grantRolePermission('discrepancy.resolve');
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $po = receivingPurchaseOrder($main, [[6, 10]]);
    completeReceiving($this, $main, $po);
    $line = $po->items()->first();

    decide($this, $cebu, shortDiscrepancyFor($line), 'accepted')->assertNotFound();

    expect($line->fresh()->short_accepted_quantity)->toBe(0);
    expect($po->fresh()->status)->toBe('ready_for_delivery');
});

test('admin decides a discrepancy on any branch', function () {
    grantRolePermission('discrepancy.resolve');
    $cebu = makePurchasingUser('CEBU');
    $admin = assignStaffRole(makeStaffUser([], 'APALIT'), 'admin');
    $po = receivingPurchaseOrder($cebu, [[6, 10]]);
    completeReceiving($this, $cebu, $po);

    decide($this, $admin, shortDiscrepancyFor($po->items()->first()), 'accepted')->assertOk();

    expect($po->fresh()->status)->toBe('closed');
});

test('over and not on document decisions only record the outcome', function (string $type, string $resolution) {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10]]);
    $line = $po->items()->first();
    $discrepancy = Discrepancy::create([
        'reference_type' => 'purchase_order', 'reference_id' => $po->id,
        'reference_item_type' => $type === 'over' ? $line->getMorphClass() : null,
        'reference_item_id' => $type === 'over' ? $line->id : null,
        'item_id' => $line->item_id, 'type' => $type, 'scanned_quantity' => 2,
    ]);

    decide($this, $user, $discrepancy, $resolution)->assertOk()->assertJsonPath('resolution', $resolution);

    expect($line->fresh()->short_accepted_quantity)->toBe(0);
    expect($po->fresh()->status)->toBe('ready_for_delivery');
})->with([
    'over accepted' => ['over', 'accepted'],
    'over redelivery' => ['over', 'redelivery_requested'],
    'not on document accepted' => ['not_found', 'accepted'],
    'not on document redelivery' => ['not_found', 'redelivery_requested'],
]);

test('accepting a shortfall on a cancelled purchase order only records the decision', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10]]);
    completeReceiving($this, $user, $po);
    $line = $po->items()->first();
    $po->update(['status' => 'cancelled']);

    decide($this, $user, shortDiscrepancyFor($line), 'accepted')->assertOk();

    expect($line->fresh()->short_accepted_quantity)->toBe(0);
    expect($po->fresh()->status)->toBe('cancelled');
});

test('completing a receipt with an over-received line now closes the purchase order', function () {
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[5, 5], [12, 10]]);

    completeReceiving($this, $user, $po)->assertOk()->assertJsonPath('status', 'closed');
});

test('completing again after an accepted shortfall does not log a new short discrepancy', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[6, 10], [1, 5]]);
    completeReceiving($this, $user, $po);
    $line = $po->items()->orderBy('id')->first();
    decide($this, $user, shortDiscrepancyFor($line), 'accepted')->assertOk();

    completeReceiving($this, $user, $po)->assertOk()->assertJsonPath('status', 'ready_for_delivery');

    expect(Discrepancy::whereMorphedTo('referenceItem', $line)->where('resolved', false)->count())->toBe(0);
});

test('accepting a short transfer line closes the transfer when it was the only gap', function () {
    grantRolePermission('discrepancy.resolve');
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5, Item::factory()->create()->id => 2]);
    $transfer->items()->each(fn ($line) => $line->update(['quantity_picked' => $line->quantity_requested]));
    $transfer->update(['status' => 'shipped', 'shipped_at' => now()]);
    [$short, $full] = $transfer->items()->orderBy('id')->get()->all();
    $short->update(['quantity_received' => 3]);
    $full->update(['quantity_received' => 2]);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/complete")
        ->assertOk()
        ->assertJsonPath('status', 'shipped');
    $discrepancy = Discrepancy::whereMorphedTo('referenceItem', $short)->firstOrFail();

    decide($this, $cebu, $discrepancy, 'accepted')->assertOk();

    $closed = TransferRequest::withoutGlobalScopes()->find($transfer->id);
    expect($closed->status)->toBe('closed');
    expect($closed->received_at)->not->toBeNull();
    expect($short->fresh()->short_accepted_quantity)->toBe(2);
});

test('requesting a redelivery on a short transfer line keeps the transfer in transit', function () {
    grantRolePermission('discrepancy.resolve');
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $transfer->items()->update(['quantity_picked' => 5, 'quantity_received' => 3]);
    $transfer->update(['status' => 'shipped', 'shipped_at' => now()]);
    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/complete")->assertOk();

    decide($this, $main, Discrepancy::where('reference_id', $transfer->id)->firstOrFail(), 'redelivery_requested')->assertOk();

    expect(TransferRequest::withoutGlobalScopes()->find($transfer->id)->status)->toBe('shipped');
});

test('the resolve permission is seeded for purchasing, admin and super admin', function () {
    $this->seed();

    $permissions = fn (string $role) => Role::findByName($role, 'staff')->permissions->pluck('name');

    expect($permissions('purchasing'))->toContain('discrepancy.resolve');
    expect($permissions('admin'))->toContain('discrepancy.resolve');
    expect($permissions('super_admin'))->toContain('discrepancy.resolve');
    expect($permissions('sales'))->not->toContain('discrepancy.resolve');
});

test('the grant migration adds the resolve permission without touching other role permissions', function () {
    $roles = collect(['purchasing', 'admin', 'sales'])->mapWithKeys(fn (string $name) => [$name => Role::findOrCreate($name, 'staff')]);
    $roles['purchasing']->givePermissionTo(Permission::firstOrCreate(['name' => 'cof.view', 'guard_name' => 'staff']));
    Permission::where('name', 'discrepancy.resolve')->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $migration = require database_path('migrations/2026_11_19_000007_grant_discrepancy_resolve_permission.php');
    $migration->up();
    $migration->up();

    $permissions = fn (string $role) => $roles[$role]->fresh()->permissions->pluck('name')->sort()->values()->all();

    expect($permissions('purchasing'))->toBe(['cof.view', 'discrepancy.resolve']);
    expect($permissions('admin'))->toBe(['discrepancy.resolve']);
    expect($permissions('sales'))->toBe([]);
});

test('an over-received line closes the purchase order but its over discrepancy stays unresolved until decided', function () {
    grantRolePermission('discrepancy.resolve');
    $user = makePurchasingUser('APALIT');
    $po = receivingPurchaseOrder($user, [[0, 5]]);
    $line = $po->items()->first();
    $line->item->update(['has_expiry' => false]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 7, 'batch_number' => 'OVER-1',
    ])->assertOk();
    completeReceiving($this, $user, $po)->assertOk()->assertJsonPath('status', 'closed');

    $over = Discrepancy::whereMorphedTo('referenceItem', $line)->where('type', 'over')->firstOrFail();
    expect($over->resolved)->toBeFalse();
    $this->actingAs($user, 'staff')->getJson('/api/staff/discrepancies?resolved=0')
        ->assertJsonPath('data.0.id', $over->id)
        ->assertJsonPath('counts.unresolved', 1);

    decide($this, $user, $over, 'accepted')->assertOk()->assertJsonPath('resolution', 'accepted');
});
