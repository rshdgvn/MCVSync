<?php

use App\Models\Item;
use App\Models\PurchaseOrder;

function makeReceivablePo(string $branchCode = 'APALIT', string $status = 'open'): PurchaseOrder
{
    $user = makeStaffUser([], $branchCode);

    return PurchaseOrder::factory()->create([
        'branch_id' => $user->employee->branch_id,
        'status' => $status,
    ]);
}

test('matching by item_id already on the po returns the line and remaining quantity', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();
    $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 10, 'quantity_received' => 3, 'unit_cost' => 5, 'discount' => 0, 'total' => 50]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/match", [
        'item_id' => $item->id,
    ]);

    $response->assertOk();
    $response->assertJsonPath('status', 'found');
    $response->assertJsonPath('remaining_quantity', 7);
});

test('matching by barcode for an item not on the po returns not_found', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create(['barcode' => '1234567890']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/match", [
        'barcode' => '1234567890',
    ]);

    $response->assertOk();
    $response->assertJsonPath('status', 'not_found');
    $response->assertJsonPath('item.id', $item->id);
});

test('matching an unknown barcode is rejected with a validation error', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/match", [
        'barcode' => 'no-such-barcode',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('barcode');
});

test('matching requires either a barcode or an item_id', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/match", []);

    $response->assertUnprocessable();
});

test('matching against a draft or closed purchase order is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $item = Item::factory()->create();

    foreach (['draft', 'closed', 'cancelled'] as $status) {
        $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => $status]);

        $this->actingAs($user, 'staff')
            ->postJson("/api/staff/purchase-orders/{$po->id}/receive/match", ['item_id' => $item->id])
            ->assertUnprocessable();
    }
});

test('sales, accounting, and logistics cannot use the receiving endpoints', function () {
    $po = makeReceivablePo();

    foreach (['sales', 'accounting', 'logistics'] as $role) {
        $user = makeStaffUser([], 'APALIT');
        assignStaffRole($user, $role);

        $this->actingAs($user, 'staff')
            ->getJson("/api/staff/purchase-orders/{$po->id}/receive")
            ->assertForbidden();
    }
});
