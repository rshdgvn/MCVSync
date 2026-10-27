<?php

use App\Models\Branch;
use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\PurchaseOrder;

test('logging a not_found discrepancy requires an item_id', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'not_found',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('item_id');
});

test('logging a not_found discrepancy with an item_id succeeds', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'not_found',
        'item_id' => $item->id,
        'scanned_quantity' => 3,
        'notes' => 'Not on this PO at all.',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('type', 'not_found');
    $response->assertJsonPath('item.id', $item->id);
    $response->assertJsonPath('resolved', false);
});

test('logging a short or over discrepancy requires a purchase_order_item_id', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'short',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('purchase_order_item_id');
});

test('discrepancies for a purchase order can be listed', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    Discrepancy::factory()->count(2)->create(['reference_id' => $po->id]);

    $response = $this->actingAs($user, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}/discrepancies");

    $response->assertOk();
    expect($response->json())->toHaveCount(2);
});

test('resolving a discrepancy records who and when', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve");

    $response->assertOk();
    $response->assertJsonPath('resolved', true);
    $response->assertJsonPath('resolved_by', $user->name);
    expect($discrepancy->fresh()->resolved_at)->not->toBeNull();
});

test('resolving an already resolved discrepancy is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id, 'resolved' => true]);

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve")
        ->assertUnprocessable();
});

test('a branch scoped purchasing user cannot resolve a discrepancy belonging to another branch', function () {
    $apalit = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);

    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $otherPo = PurchaseOrder::factory()->create(['branch_id' => $cebu->id]);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $otherPo->id]);

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve")
        ->assertNotFound();
});

test('admin can resolve a discrepancy on any branch', function () {
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);

    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    $po = PurchaseOrder::factory()->create(['branch_id' => $cebu->id]);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id]);

    $this->actingAs($admin, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve")
        ->assertOk();
});
