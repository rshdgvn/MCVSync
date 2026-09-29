<?php

use App\Models\ClientItemPrice;
use App\Models\Item;
use App\Models\PurchaseOrderItem;

test('accounting can set a price and it appears as the current price', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id,
        'item_id' => $item->id,
        'srp' => 150.50,
    ]);

    $response->assertCreated();
    $response->assertJsonPath('srp', 150.5);
    $response->assertJsonPath('set_by', $user->name);

    $list = $this->actingAs($user, 'staff')->getJson("/api/staff/pricing/client-item-prices?client_id={$client->id}&item_id={$item->id}");
    expect($list->json('data'))->toHaveCount(1);
    $list->assertJsonPath('data.0.srp', 150.5);
});

test('setting a new price never updates the existing row, it writes a new one', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 100,
    ])->assertCreated();

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 120,
    ])->assertCreated();

    expect(ClientItemPrice::where('client_id', $client->id)->where('item_id', $item->id)->count())->toBe(2);

    $current = $this->actingAs($user, 'staff')->getJson("/api/staff/pricing/client-item-prices?client_id={$client->id}&item_id={$item->id}");
    expect($current->json('data'))->toHaveCount(1);
    $current->assertJsonPath('data.0.srp', 120);
});

test('super admin can also set a price', function () {
    $superAdmin = makeStaffUser();
    assignStaffRole($superAdmin, 'super_admin');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $this->actingAs($superAdmin, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 75,
    ])->assertCreated();
});

test('sales can read pricing but cannot set a price', function () {
    $sales = makeStaffUser();
    assignStaffRole($sales, 'sales');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $this->actingAs($sales, 'staff')->getJson('/api/staff/pricing/client-item-prices')->assertOk();

    $this->actingAs($sales, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 50,
    ])->assertForbidden();
});

test('admin can read pricing but cannot set a price', function () {
    $admin = makeStaffUser();
    assignStaffRole($admin, 'admin');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $this->actingAs($admin, 'staff')->getJson('/api/staff/pricing/client-item-prices')->assertOk();

    $this->actingAs($admin, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 50,
    ])->assertForbidden();
});

test('purchasing has no access to pricing at all', function () {
    $purchasing = makeStaffUser();
    assignStaffRole($purchasing, 'purchasing');

    $this->actingAs($purchasing, 'staff')->getJson('/api/staff/pricing/client-item-prices')->assertForbidden();
});

test('logistics has no access to pricing at all', function () {
    $logistics = makeStaffUser();
    assignStaffRole($logistics, 'logistics');

    $this->actingAs($logistics, 'staff')->getJson('/api/staff/pricing/client-item-prices')->assertForbidden();
});

test('pricing items reference list includes computed cogs from the most recent po line', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $item = Item::factory()->create();

    $olderLine = PurchaseOrderItem::factory()->create(['item_id' => $item->id, 'unit_cost' => 10]);
    $olderLine->forceFill(['created_at' => now()->subDays(5)])->save();

    $newerLine = PurchaseOrderItem::factory()->create(['item_id' => $item->id, 'unit_cost' => 15]);
    $newerLine->forceFill(['created_at' => now()->subDay()])->save();

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/items');

    $response->assertOk();
    $row = collect($response->json('data'))->firstWhere('id', $item->id);
    expect($row['cogs'])->toBe(15);
});

test('an item never purchased has a null cogs', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $item = Item::factory()->create();

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/items');

    $row = collect($response->json('data'))->firstWhere('id', $item->id);
    expect($row['cogs'])->toBeNull();
});

test('the inventory item show endpoint also includes cogs', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');
    $item = Item::factory()->create();
    PurchaseOrderItem::factory()->create(['item_id' => $item->id, 'unit_cost' => 42]);

    $response = $this->actingAs($user, 'staff')->getJson("/api/staff/inventory/items/{$item->id}");

    $response->assertOk();
    $response->assertJsonPath('cogs', 42);
});

test('creating a client item price validates required fields', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['client_id', 'item_id', 'srp']);
});
