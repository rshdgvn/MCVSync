<?php

use App\Models\AuditLog;
use App\Models\ClientOrderForm;
use App\Models\Delivery;
use App\Models\Item;
use App\Models\Payment;
use App\Models\User;
use App\Services\DeliveryService;
use App\Support\BusinessDate;

function makeLogisticsUser(string $branchCode = 'APALIT'): User
{
    grantRolePermission('logistics.view', ['logistics', 'admin', 'super_admin']);
    grantRolePermission('logistics.confirm_delivery', ['logistics', 'super_admin']);
    grantRolePermission('delivery_history.view', ['logistics', 'sales', 'admin', 'super_admin']);

    return assignStaffRole(makeStaffUser([], $branchCode), 'logistics');
}

function readyOrder($test, string $branchCode = 'APALIT'): array
{
    $sales = makeSalesUser($branchCode);
    $picker = makePurchasingUser($branchCode);
    $clientUser = makeClientUser([], 'Pampanga/Bulacan', $branchCode);
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-'.$branchCode);
    $cof = forwardedOrder($test, $sales, $clientUser, [$item->id => 4], 25);
    $cof->update(['terms' => '30 Days']);
    $test->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 4])
        ->assertOk()
        ->assertJsonPath('order_status', 'ready_for_delivery');

    return [$cof->fresh(), $clientUser, $sales];
}

function confirmDelivery($test, User $user, ClientOrderForm $cof, array $overrides = [])
{
    return $test->actingAs($user, 'staff')->postJson("/api/staff/logistics/ready-to-deliver/{$cof->id}/confirm", [
        'delivery_date' => BusinessDate::todayString(),
        'received_by' => 'Maria Santos',
        'notes' => 'Left with the clinic receptionist.',
        ...$overrides,
    ]);
}

test('confirming delivery records it, moves the order to delivered and lets the client confirm with the payment due from the delivery date', function () {
    $logistics = makeLogisticsUser();
    [$cof, $clientUser] = readyOrder($this);
    $deliveredOn = BusinessDate::today()->toDateString();

    confirmDelivery($this, $logistics, $cof)
        ->assertCreated()
        ->assertJsonPath('cof_number', $cof->cof_number)
        ->assertJsonPath('received_by', 'Maria Santos')
        ->assertJsonPath('confirmed_by', $logistics->name);

    expect($cof->fresh()->order_status)->toBe('delivered');
    expect(Delivery::sole()->delivery_date->toDateString())->toBe($deliveredOn);
    expect(AuditLog::where('action', 'client_order_form.delivered')->sole()->metadata['summary'])
        ->toBe("Order {$cof->cof_number} confirmed delivered by {$logistics->name}");

    $this->actingAs($clientUser, 'client')->getJson("/api/portal/orders/{$cof->id}")
        ->assertJsonPath('delivery_date', $deliveredOn)
        ->assertJsonPath('received_by', 'Maria Santos');
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")
        ->assertOk()
        ->assertJsonPath('order_status', 'completed');

    expect(Payment::sole()->expected_payment_date->toDateString())->toBe(BusinessDate::today()->addDays(30)->toDateString());
});

test('the payment is due the terms after the recorded delivery date, not the confirm date', function () {
    $logistics = makeLogisticsUser();
    [$cof, $clientUser] = readyOrder($this);
    ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['ready_for_delivery_at' => BusinessDate::today()->subDays(5)]);
    $deliveredOn = BusinessDate::today()->subDays(3)->toDateString();

    confirmDelivery($this, $logistics, $cof, ['delivery_date' => $deliveredOn])->assertCreated();
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")->assertOk();

    expect(Payment::sole()->expected_payment_date->toDateString())->toBe(BusinessDate::today()->subDays(3)->addDays(30)->toDateString());
});

test('delivery cannot be confirmed from any status other than ready for delivery', function (string $status) {
    $logistics = makeLogisticsUser();
    [$cof] = readyOrder($this);
    ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['order_status' => $status]);

    confirmDelivery($this, $logistics, $cof)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Only an order that is ready for delivery can be confirmed delivered.']);

    expect(Delivery::count())->toBe(0);
})->with(['pending_approval', 'needs_revision', 'processing', 'completed', 'cancelled']);

test('delivery cannot be confirmed while a cancellation request is open', function () {
    $logistics = makeLogisticsUser();
    [$cof, $clientUser] = readyOrder($this);
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")->assertOk();

    confirmDelivery($this, $logistics, $cof)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cancellation_requested']);

    expect($cof->fresh()->order_status)->toBe('ready_for_delivery');
});

test('a second confirmation returns 409 and keeps one delivery record', function () {
    $logistics = makeLogisticsUser();
    [$cof] = readyOrder($this);

    confirmDelivery($this, $logistics, $cof)->assertCreated();
    confirmDelivery($this, $logistics, $cof)
        ->assertStatus(409)
        ->assertJsonPath('message', 'This order has already been confirmed delivered.');

    expect(Delivery::count())->toBe(1);
});

test('the unique delivery record turns a racing duplicate into a 409', function () {
    $logistics = makeLogisticsUser();
    [$cof] = readyOrder($this);
    Delivery::create([
        'client_order_form_id' => $cof->id, 'delivery_date' => BusinessDate::todayString(),
        'received_by' => 'Someone', 'confirmed_by' => $logistics->employee->id,
    ]);

    expect(fn () => app(DeliveryService::class)->confirm($cof, ['delivery_date' => BusinessDate::todayString(), 'received_by' => 'Maria'], $logistics->employee, null))
        ->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class, 'This order has already been confirmed delivered.');
});

test('the delivery date cannot be in the future or before the order was ready', function () {
    $logistics = makeLogisticsUser();
    [$cof] = readyOrder($this);

    confirmDelivery($this, $logistics, $cof, ['delivery_date' => BusinessDate::today()->addDay()->toDateString()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['delivery_date' => 'The delivery date cannot be in the future.']);
    confirmDelivery($this, $logistics, $cof, ['delivery_date' => BusinessDate::today()->subDay()->toDateString()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['delivery_date']);
    confirmDelivery($this, $logistics, $cof, ['received_by' => ''])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['received_by']);

    expect($cof->fresh()->order_status)->toBe('ready_for_delivery');
});

test('logistics from another branch cannot confirm or see the order', function () {
    makeLogisticsUser();
    $cebuLogistics = makeLogisticsUser('CEBU');
    [$cof] = readyOrder($this);

    confirmDelivery($this, $cebuLogistics, $cof)->assertNotFound();
    $this->actingAs($cebuLogistics, 'staff')->getJson('/api/staff/logistics/ready-to-deliver')->assertJsonCount(0, 'data');
    $this->actingAs($cebuLogistics, 'staff')->getJson('/api/staff/logistics/incoming-orders')->assertJsonCount(0, 'data');

    expect($cof->fresh()->order_status)->toBe('ready_for_delivery');
});

test('sales, purchasing and accounting cannot confirm a delivery', function (string $role) {
    makeLogisticsUser();
    [$cof] = readyOrder($this);
    grantRolePermission('cof.view', ['accounting']);

    confirmDelivery($this, assignStaffRole(makeStaffUser([], 'APALIT'), $role), $cof)->assertForbidden();
})->with(['sales', 'purchasing', 'accounting']);

test('ready_for_delivery_at is set when a full pick makes the order ready', function () {
    [$cof] = readyOrder($this);

    expect($cof->ready_for_delivery_at)->not->toBeNull();
});

test('ready_for_delivery_at is set when Sales approves a short order for dispatch', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);
    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 3])->assertOk();
    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete")->assertOk();
    expect($cof->fresh()->ready_for_delivery_at)->toBeNull();

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve")->assertOk();

    expect($cof->fresh()->ready_for_delivery_at)->not->toBeNull();
});

test('the ready-to-deliver queue shows narrow fields oldest first with days in queue and aging', function () {
    $logistics = makeLogisticsUser();
    [$older] = readyOrder($this);
    [$newer] = readyOrder($this);
    ClientOrderForm::withoutGlobalScopes()->whereKey($older->id)->update(['ready_for_delivery_at' => BusinessDate::today()->subDays(3)->addHours(12)->setTimezone('UTC')]);

    $this->actingAs($logistics, 'staff')->getJson('/api/staff/logistics/ready-to-deliver')
        ->assertOk()
        ->assertJsonPath('data.0.cof_number', $older->cof_number)
        ->assertJsonPath('data.0.days_in_queue', 3)
        ->assertJsonPath('data.0.is_aging', true)
        ->assertJsonPath('data.0.order_total', 100)
        ->assertJsonPath('data.1.cof_number', $newer->cof_number)
        ->assertJsonPath('data.1.is_aging', false)
        ->assertJsonMissingPath('data.0.items')
        ->assertJsonMissingPath('data.0.unit_cost');
});

test('delivery history filters by date and is visible to sales but not purchasing', function () {
    $logistics = makeLogisticsUser();
    [$cof] = readyOrder($this);
    confirmDelivery($this, $logistics, $cof)->assertCreated();
    $today = BusinessDate::todayString();

    $this->actingAs($logistics, 'staff')->getJson("/api/staff/logistics/delivery-history?from={$today}&to={$today}")
        ->assertOk()
        ->assertJsonPath('data.0.cof_number', $cof->cof_number)
        ->assertJsonPath('data.0.confirmed_by', $logistics->name);
    $this->actingAs($logistics, 'staff')->getJson('/api/staff/logistics/delivery-history?to='.BusinessDate::today()->subDay()->toDateString())
        ->assertJsonCount(0, 'data');

    $this->actingAs(makeSalesUser(), 'staff')->getJson('/api/staff/logistics/delivery-history')->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs(makePurchasingUser('APALIT'), 'staff')->getJson('/api/staff/logistics/delivery-history')->assertForbidden();
});

test('the summary counts ready and delivered-today orders and averages delivery time in SQL', function () {
    $logistics = makeLogisticsUser();
    [$delivered] = readyOrder($this);
    readyOrder($this);
    ClientOrderForm::withoutGlobalScopes()->whereKey($delivered->id)->update(['ready_for_delivery_at' => now()->subHours(6)]);
    confirmDelivery($this, $logistics, $delivered, ['delivery_date' => BusinessDate::todayString()])->assertCreated();

    $summary = $this->actingAs($logistics, 'staff')->getJson('/api/staff/logistics/summary')->assertOk()->json();

    expect($summary['ready_to_deliver'])->toBe(1);
    expect($summary['delivered_today'])->toBe(1);
    expect($summary['average_delivery_hours_this_week'])->toBeGreaterThanOrEqual(5.9)->toBeLessThanOrEqual(6.1);
});

test('the logistics permissions are seeded and dispatch.approve is renamed', function () {
    $this->seed();

    $permissions = fn (string $role) => Spatie\Permission\Models\Role::findByName($role, 'staff')->permissions->pluck('name');

    expect($permissions('logistics'))->toContain('logistics.view', 'logistics.confirm_delivery', 'delivery_history.view')->not->toContain('dispatch.approve');
    expect($permissions('admin'))->toContain('logistics.view', 'delivery_history.view')->not->toContain('logistics.confirm_delivery');
    expect($permissions('sales'))->toContain('delivery_history.view');
    expect($permissions('super_admin'))->toContain('logistics.confirm_delivery');
});

test('the rename migration keeps dispatch.approve grants as logistics.confirm_delivery without touching other permissions', function () {
    $logistics = Spatie\Permission\Models\Role::findOrCreate('logistics', 'staff');
    $custom = Spatie\Permission\Models\Role::findOrCreate('dispatcher', 'staff');
    Spatie\Permission\Models\Permission::where('name', 'logistics.confirm_delivery')->delete();
    $old = Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'dispatch.approve', 'guard_name' => 'staff']);
    $logistics->givePermissionTo($old, Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'transfer.request', 'guard_name' => 'staff']));
    $custom->givePermissionTo($old);
    app(Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

    $migration = require database_path('migrations/2026_11_20_000012_rename_dispatch_approve_to_logistics_confirm_delivery.php');
    $migration->up();
    $migration->up();

    expect($logistics->fresh()->permissions->pluck('name')->sort()->values()->all())->toBe(['logistics.confirm_delivery', 'transfer.request']);
    expect($custom->fresh()->permissions->pluck('name')->all())->toBe(['logistics.confirm_delivery']);
    expect(Spatie\Permission\Models\Permission::where('name', 'dispatch.approve')->exists())->toBeFalse();
});
