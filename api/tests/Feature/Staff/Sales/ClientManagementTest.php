<?php

use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Models\Item;
use App\Models\User;
use App\Models\Zone;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

function newClientPayload(array $overrides = []): array
{
    return [
        'name' => 'San Fernando Clinic',
        'email' => 'orders@sfclinic.test',
        'password' => 'secret-password',
        'address' => 'San Fernando, Pampanga',
        'contact' => '0917 555 0101',
        'zone_id' => Zone::firstOrCreate(['name' => 'Pampanga/Bulacan'])->id,
        'client_type' => 'direct',
        ...$overrides,
    ];
}

test('sales creates a client account with its business profile at its own branch', function () {
    $sales = makeSalesUser('CEBU');

    $this->actingAs($sales, 'staff')->postJson('/api/staff/clients', newClientPayload())
        ->assertCreated()
        ->assertJsonPath('name', 'San Fernando Clinic')
        ->assertJsonPath('email', 'orders@sfclinic.test')
        ->assertJsonPath('branch.id', testBranch('CEBU')->id);

    $user = User::where('email', 'orders@sfclinic.test')->sole();
    expect($user->type)->toBe('client');
    expect(Client::where('user_id', $user->id)->exists())->toBeTrue();

    $this->actingAs($sales, 'staff')->postJson('/api/staff/clients', newClientPayload())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('sales updates a client profile at its branch but not another branch\'s client', function () {
    $sales = makeSalesUser();
    $mine = clientOf(makeClientUser());
    $cebuClient = clientOf(makeClientUser([], 'Pampanga/Bulacan', 'CEBU'));

    $this->actingAs($sales, 'staff')->patchJson("/api/staff/clients/{$mine->id}", ['name' => 'Renamed Clinic', 'client_type' => 'reseller'])
        ->assertOk()
        ->assertJsonPath('name', 'Renamed Clinic')
        ->assertJsonPath('client_type', 'reseller');

    $this->actingAs($sales, 'staff')->patchJson("/api/staff/clients/{$cebuClient->id}", ['name' => 'x'])->assertNotFound();
    $this->actingAs($sales, 'staff')->getJson('/api/staff/clients')->assertJsonPath('meta.total', 1);
});

test('roles without client permissions cannot manage clients', function () {
    makeSalesUser();
    $purchasing = makePurchasingUser('APALIT');

    $this->actingAs($purchasing, 'staff')->getJson('/api/staff/clients')->assertForbidden();
    $this->actingAs($purchasing, 'staff')->postJson('/api/staff/clients', newClientPayload())->assertForbidden();
});

test('standing discounts are append-only and the newest one pre-fills new order lines', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();

    foreach ([5, 12.5] as $percent) {
        $this->actingAs($sales, 'staff')->postJson('/api/staff/client-discounts', [
            'client_id' => clientOf($clientUser)->id, 'item_id' => $item->id, 'discount_percent' => $percent,
        ])->assertCreated();
    }

    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-discounts?client_id='.clientOf($clientUser)->id)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.discount_percent', 12.5);
    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-discounts/'.clientOf($clientUser)->id."/{$item->id}/history")
        ->assertJsonCount(2);

    $cof = portalOrder($this, $clientUser, [$item->id => 3]);
    expect((float) $cof->items()->value('discount_percent'))->toBe(12.5);

    $this->actingAs($sales, 'staff')->postJson('/api/staff/client-discounts', ['client_id' => clientOf($clientUser)->id, 'item_id' => $item->id, 'discount_percent' => 120])
        ->assertUnprocessable();
});

test('client insights show the most ordered items and the ordering rhythm', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $gloves = Item::factory()->create(['name' => 'Gloves']);
    $masks = Item::factory()->create(['name' => 'Masks']);
    foreach ([[40, [$gloves->id => 2, $masks->id => 1]], [20, [$gloves->id => 3]], [0, [$gloves->id => 1]]] as [$daysAgo, $lines]) {
        $cof = portalOrder($this, $clientUser, $lines);
        ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['created_at' => now()->subDays($daysAgo)]);
    }

    $this->actingAs($sales, 'staff')->getJson('/api/staff/clients/'.clientOf($clientUser)->id.'/insights')
        ->assertOk()
        ->assertJsonPath('order_count', 3)
        ->assertJsonPath('top_items.0.name', 'Gloves')
        ->assertJsonPath('top_items.0.order_count', 3)
        ->assertJsonPath('top_items.1.name', 'Masks')
        ->assertJsonPath('average_order_interval_days', 20)
        ->assertJsonPath('days_since_last_order', 0);

    $this->actingAs($sales, 'staff')->getJson('/api/staff/clients/'.clientOf($clientUser)->id.'/orders')->assertJsonPath('meta.total', 3);
});

test('sales analytics reports volume, top clients and items, and quiet clients for its branch only', function () {
    $sales = makeSalesUser();
    $active = makeClientUser(['name' => 'Active Clinic']);
    $quiet = makeClientUser(['name' => 'Quiet Clinic']);
    $cebu = makeClientUser(['name' => 'Cebu Clinic'], 'Pampanga/Bulacan', 'CEBU');
    $item = Item::factory()->create(['name' => 'Gauze']);
    stockAt($sales, $item, 50, '2027-06-30', 'G-1');
    forwardedOrder($this, $sales, $active, [$item->id => 4], 50);
    $old = portalOrder($this, $quiet, [$item->id => 1]);
    ClientOrderForm::withoutGlobalScopes()->whereKey($old->id)->update(['created_at' => now()->subDays(45)]);
    portalOrder($this, $cebu, [$item->id => 9]);

    $response = $this->actingAs($sales, 'staff')->getJson('/api/staff/sales/analytics')->assertOk();

    expect($response->json('monthly'))->toHaveCount(6);
    expect(collect($response->json('monthly'))->last()['order_value'])->toEqual(200);
    $response->assertJsonPath('top_clients.0.name', 'Active Clinic')
        ->assertJsonPath('top_items.0.name', 'Gauze')
        ->assertJsonPath('top_items.0.total_quantity', 4)
        ->assertJsonCount(1, 'quiet_clients')
        ->assertJsonPath('quiet_clients.0.name', 'Quiet Clinic');
});

test('sales sees only item, branch and days left for near-expiry stock', function () {
    $sales = makeSalesUser();
    $item = Item::factory()->create(['name' => 'Saline', 'expiry_alert_threshold_days' => 30]);
    stockAt($sales, $item, 5, now()->addDays(10)->toDateString(), 'SAL-1');
    stockAt($sales, $item, 7, now()->addDays(20)->toDateString(), 'SAL-2');
    stockAt($sales, Item::factory()->create(['expiry_alert_threshold_days' => 30]), 5, now()->addDays(200)->toDateString(), 'FAR-1');

    $this->actingAs($sales, 'staff')->getJson('/api/staff/sales/expiry-alerts')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.item.name', 'Saline')
        ->assertJsonPath('data.0.days_remaining', 10)
        ->assertJsonMissingPath('data.0.batch_number')
        ->assertJsonMissingPath('data.0.quantity')
        ->assertJsonMissingPath('data.0.id');

    $this->actingAs(makePurchasingUser('APALIT'), 'staff')->getJson('/api/staff/sales/expiry-alerts')->assertForbidden();
});

test('the new permissions are seeded for the right roles', function () {
    $this->seed();

    $permissions = fn (string $role) => Role::findByName($role, 'staff')->permissions->pluck('name');

    expect($permissions('sales'))->toContain('client.manage', 'cof.approve_dispatch', 'cof.confirm_cancellation');
    expect($permissions('purchasing'))->toContain('cof.confirm_cancellation');
    expect($permissions('accounting'))->toContain('cof.view');
    expect($permissions('admin'))->toContain('cof.view')->not->toContain('client.manage');
    expect($permissions('super_admin'))->toContain('client.manage', 'cof.approve_dispatch', 'cof.confirm_cancellation');
});

test('the grant migrations add permissions without touching other role permissions', function () {
    $roles = collect(['sales', 'purchasing', 'accounting', 'admin'])->mapWithKeys(fn (string $name) => [$name => Role::findOrCreate($name, 'staff')]);
    $roles['sales']->givePermissionTo(Permission::firstOrCreate(['name' => 'client.view', 'guard_name' => 'staff']));
    Permission::whereIn('name', ['client.manage', 'cof.approve_dispatch', 'cof.confirm_cancellation', 'cof.view'])->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    foreach (['000006_grant_client_manage_permission', '000007_grant_cof_approve_dispatch_permission', '000008_grant_cof_confirm_cancellation_permission', '000009_grant_cof_view_to_accounting_and_admin'] as $name) {
        $migration = require database_path("migrations/2026_11_20_{$name}.php");
        $migration->up();
        $migration->up();
    }

    $permissions = fn (string $role) => $roles[$role]->fresh()->permissions->pluck('name')->sort()->values()->all();

    expect($permissions('sales'))->toBe(['client.manage', 'client.view', 'cof.approve_dispatch', 'cof.confirm_cancellation', 'cof.view']);
    expect($permissions('purchasing'))->toBe(['cof.confirm_cancellation']);
    expect($permissions('accounting'))->toBe(['cof.view']);
    expect($permissions('admin'))->toBe(['cof.view']);
});
