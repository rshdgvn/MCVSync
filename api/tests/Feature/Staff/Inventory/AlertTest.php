<?php

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Item;

test('expiring alert flags batches within the item threshold and excludes those outside it', function () {
    $branch = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $item = Item::factory()->create(['expiry_alert_threshold_days' => 10]);

    $soon = Batch::factory()->create([
        'item_id' => $item->id,
        'branch_id' => $branch->id,
        'expiry_date' => now()->addDays(5)->toDateString(),
    ]);
    $farOut = Batch::factory()->create([
        'item_id' => $item->id,
        'branch_id' => $branch->id,
        'expiry_date' => now()->addDays(90)->toDateString(),
    ]);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/expiring');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($soon->id)->not->toContain($farOut->id);
});

test('expiring alert falls back to the system default threshold when the item has none', function () {
    $branch = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    config(['inventory.default_expiry_alert_threshold_days' => 15]);

    $item = Item::factory()->create(['expiry_alert_threshold_days' => null]);

    $withinDefault = Batch::factory()->create([
        'item_id' => $item->id,
        'branch_id' => $branch->id,
        'expiry_date' => now()->addDays(10)->toDateString(),
    ]);
    $beyondDefault = Batch::factory()->create([
        'item_id' => $item->id,
        'branch_id' => $branch->id,
        'expiry_date' => now()->addDays(45)->toDateString(),
    ]);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/expiring');

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($withinDefault->id)->not->toContain($beyondDefault->id);
});

test('low stock alert flags items at or below their reorder point', function () {
    $branch = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $low = Item::factory()->create(['reorder_point' => 10]);
    Batch::factory()->create(['item_id' => $low->id, 'branch_id' => $branch->id, 'quantity' => 5, 'status' => 'active']);

    $healthy = Item::factory()->create(['reorder_point' => 10]);
    Batch::factory()->create(['item_id' => $healthy->id, 'branch_id' => $branch->id, 'quantity' => 50, 'status' => 'active']);

    $noThreshold = Item::factory()->create(['reorder_point' => null]);
    Batch::factory()->create(['item_id' => $noThreshold->id, 'branch_id' => $branch->id, 'quantity' => 1, 'status' => 'active']);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/low-stock');

    $response->assertOk();
    $itemIds = collect($response->json('data'))->pluck('item_id');
    expect($itemIds)
        ->toContain($low->id)
        ->not->toContain($healthy->id)
        ->not->toContain($noThreshold->id);
});

test('low stock summary counts every matching item, not just the current page', function () {
    $branch = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    foreach ([3, 7, 0] as $quantity) {
        $item = Item::factory()->create(['reorder_point' => 10]);
        Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $branch->id, 'quantity' => $quantity, 'status' => 'active']);
    }
    Item::factory()->create(['reorder_point' => 10]);
    $healthy = Item::factory()->create(['reorder_point' => 10]);
    Batch::factory()->create(['item_id' => $healthy->id, 'branch_id' => $branch->id, 'quantity' => 50, 'status' => 'active']);

    $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/low-stock?per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('summary.low_stock', 4)
        ->assertJsonPath('summary.out_of_stock', 2);
});

test('low stock summary is scoped to the user branch', function () {
    $apalit = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $item = Item::factory()->create(['reorder_point' => 10]);
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $apalit->id, 'quantity' => 50, 'status' => 'active']);
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $cebu->id, 'quantity' => 2, 'status' => 'active']);

    $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/low-stock')
        ->assertOk()
        ->assertJsonPath('summary.low_stock', 0)
        ->assertJsonPath('summary.out_of_stock', 0);
});
