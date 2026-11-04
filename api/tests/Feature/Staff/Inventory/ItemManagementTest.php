<?php

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Item;
use App\Models\StockReservation;
use App\Models\Unit;

test('purchasing can create and update an item', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $category = Category::factory()->create();
    $unit = Unit::factory()->create();

    $create = $this->actingAs($user, 'staff')->postJson('/api/staff/inventory/items', [
        'name' => 'Surgical Gloves',
        'sku' => 'SKU-0001',
        'category_id' => $category->id,
        'unit_id' => $unit->id,
        'has_expiry' => true,
        'reorder_point' => 20,
        'reorder_quantity' => 100,
    ]);

    $create->assertCreated();
    $create->assertJsonPath('name', 'Surgical Gloves');
    $create->assertJsonPath('category.id', $category->id);
    $itemId = $create->json('id');

    $update = $this->actingAs($user, 'staff')->patchJson("/api/staff/inventory/items/{$itemId}", [
        'name' => 'Surgical Gloves (Large)',
        'sku' => 'SKU-0001',
        'category_id' => $category->id,
        'unit_id' => $unit->id,
        'reorder_point' => 25,
    ]);

    $update->assertOk();
    $update->assertJsonPath('name', 'Surgical Gloves (Large)');
    $update->assertJsonPath('reorder_point', 25);
});

test('purchasing can fetch a single item by id', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $item = Item::factory()->create(['name' => 'Surgical Gloves']);

    $response = $this->actingAs($user, 'staff')->getJson("/api/staff/inventory/items/{$item->id}");

    $response->assertOk();
    $response->assertJsonPath('name', 'Surgical Gloves');
    $response->assertJsonPath('category.id', $item->category_id);
});

test('sales has no access to items at all', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'sales');

    $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/items')->assertForbidden();
});

test('items index filters by category, active status, and branch stock presence', function () {
    $admin = makeStaffUser();
    assignStaffRole($admin, 'admin');

    $categoryA = Category::factory()->create();
    $categoryB = Category::factory()->create();
    $branch = Branch::factory()->create();
    $otherBranch = Branch::factory()->create();

    $inStockAtBranch = Item::factory()->create(['category_id' => $categoryA->id, 'is_active' => true]);
    Batch::factory()->create(['item_id' => $inStockAtBranch->id, 'branch_id' => $branch->id, 'quantity' => 10, 'status' => 'active']);

    $notAtBranch = Item::factory()->create(['category_id' => $categoryA->id, 'is_active' => true]);
    Batch::factory()->create(['item_id' => $notAtBranch->id, 'branch_id' => $otherBranch->id, 'quantity' => 10, 'status' => 'active']);

    $inactiveItem = Item::factory()->create(['category_id' => $categoryA->id, 'is_active' => false]);
    $otherCategoryItem = Item::factory()->create(['category_id' => $categoryB->id, 'is_active' => true]);

    $byCategory = $this->actingAs($admin, 'staff')
        ->getJson("/api/staff/inventory/items?category_id={$categoryA->id}");
    $byCategory->assertOk();
    expect(collect($byCategory->json('data'))->pluck('id'))
        ->toContain($inStockAtBranch->id, $notAtBranch->id, $inactiveItem->id)
        ->not->toContain($otherCategoryItem->id);

    $activeOnly = $this->actingAs($admin, 'staff')->getJson('/api/staff/inventory/items?is_active=1');
    expect(collect($activeOnly->json('data'))->pluck('id'))->not->toContain($inactiveItem->id);

    $byBranchStock = $this->actingAs($admin, 'staff')
        ->getJson("/api/staff/inventory/items?branch_id={$branch->id}");
    expect(collect($byBranchStock->json('data'))->pluck('id'))
        ->toContain($inStockAtBranch->id)
        ->not->toContain($notAtBranch->id);
});

test('items index searches by name or sku', function () {
    $admin = makeStaffUser();
    assignStaffRole($admin, 'admin');

    $gloves = Item::factory()->create(['name' => 'Surgical Gloves', 'sku' => 'SKU-GLV-01']);
    $bandages = Item::factory()->create(['name' => 'Bandages', 'sku' => 'SKU-BND-01']);

    $byName = $this->actingAs($admin, 'staff')->getJson('/api/staff/inventory/items?search=glove');
    expect(collect($byName->json('data'))->pluck('id'))->toContain($gloves->id)->not->toContain($bandages->id);

    $bySku = $this->actingAs($admin, 'staff')->getJson('/api/staff/inventory/items?search=BND');
    expect(collect($bySku->json('data'))->pluck('id'))->toContain($bandages->id)->not->toContain($gloves->id);
});

test('the items list returns available stock for the acting branch and the effective expiry threshold', function () {
    $user = makePurchasingUser('APALIT');
    $cebu = Branch::factory()->create(['code' => 'CEBU']);
    $item = Item::factory()->create(['expiry_alert_threshold_days' => null]);
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $user->employee->branch_id, 'quantity' => 10]);
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $cebu->id, 'quantity' => 5]);
    StockReservation::create([
        'item_id' => $item->id, 'branch_id' => $user->employee->branch_id, 'quantity' => 3,
        'reference_type' => 'transfer_request', 'reference_id' => 1, 'status' => 'active',
    ]);

    $row = collect($this->actingAs($user, 'staff')->getJson('/api/staff/inventory/items')->assertOk()->json('data'))
        ->firstWhere('id', $item->id);

    expect($row['available'])->toBe(7);
    expect($row['effective_expiry_alert_threshold_days'])->toBe(30);

    $admin = assignStaffRole(makeStaffUser([], 'APALIT'), 'admin');
    app()->forgetInstance('currentBranchId');
    $adminRow = collect($this->actingAs($admin, 'staff')->getJson('/api/staff/inventory/items')->json('data'))
        ->firstWhere('id', $item->id);

    expect($adminRow['available'])->toBe(12);
});

test('the items list returns status counts that ignore the status filter but respect search', function () {
    $user = makePurchasingUser('APALIT');
    Item::factory()->count(3)->create(['is_active' => true, 'name' => 'Gauze pad']);
    Item::factory()->create(['is_active' => false, 'name' => 'Gauze roll']);
    Item::factory()->create(['is_active' => true, 'name' => 'Syringe']);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/inventory/items?search=gauze&is_active=0');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('counts'))->toBe(['all' => 4, 'active' => 3, 'inactive' => 1]);
});
