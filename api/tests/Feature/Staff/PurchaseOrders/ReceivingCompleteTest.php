<?php

use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDiscrepancy;

test('completing a session closes the po when every line exactly matches', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();
    $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 5, 'quantity_received' => 5, 'unit_cost' => 10, 'discount' => 0, 'total' => 50]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete");

    $response->assertOk();
    $response->assertJsonPath('status', 'closed');
});

test('completing a session with a short line keeps the po open and logs a short discrepancy', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();
    $line = $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 10, 'quantity_received' => 4, 'unit_cost' => 10, 'discount' => 0, 'total' => 100]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete");

    $response->assertOk();
    $response->assertJsonPath('status', 'open');

    $discrepancy = PurchaseOrderDiscrepancy::where('purchase_order_item_id', $line->id)->where('type', 'short')->first();
    expect($discrepancy)->not->toBeNull();
    expect($discrepancy->scanned_quantity)->toBe(4);
    expect($discrepancy->resolved)->toBeFalse();
});

test('completing a session twice for the same short line does not create a duplicate discrepancy', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();
    $line = $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 10, 'quantity_received' => 4, 'unit_cost' => 10, 'discount' => 0, 'total' => 100]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")->assertOk();
    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")->assertOk();

    expect(PurchaseOrderDiscrepancy::where('purchase_order_item_id', $line->id)->where('type', 'short')->count())->toBe(1);
});

test('a resolved short discrepancy is not reused if the line becomes short again after being completed', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();
    $line = $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 10, 'quantity_received' => 4, 'unit_cost' => 10, 'discount' => 0, 'total' => 100]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")->assertOk();
    $existing = PurchaseOrderDiscrepancy::where('purchase_order_item_id', $line->id)->where('type', 'short')->first();
    $existing->update(['resolved' => true]);

    $line->update(['quantity_received' => 6]);
    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")->assertOk();

    $unresolved = PurchaseOrderDiscrepancy::where('purchase_order_item_id', $line->id)->where('type', 'short')->where('resolved', false)->get();
    expect($unresolved)->toHaveCount(1);
    expect($unresolved->first()->scanned_quantity)->toBe(6);
});

test('completing an already closed purchase order is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'closed']);

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")
        ->assertUnprocessable();
});
