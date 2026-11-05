<?php

use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\Supplier;

function openOrderWithLines(int $branchId, int $lineCount): PurchaseOrder
{
    $po = PurchaseOrder::factory()->create(['branch_id' => $branchId, 'status' => 'open']);
    for ($index = 0; $index < $lineCount; $index++) {
        $po->items()->create([
            'item_id' => Item::factory()->create()->id,
            'quantity_ordered' => 2,
            'unit_cost' => 10,
            'discount' => 0,
            'total' => 20,
        ]);
    }

    return $po;
}

test('the last line of a purchase order cannot be removed', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = openOrderWithLines($user->employee->branch_id, 1);
    $line = $po->items()->first();

    $response = $this->actingAs($user, 'staff')->deleteJson("/api/staff/purchase-orders/{$po->id}/items/{$line->id}");

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['item' => 'A purchase order needs at least one item. Add another item before removing this one.']);
    expect($po->items()->count())->toBe(1);
});

test('a line can still be removed while another line remains', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = openOrderWithLines($user->employee->branch_id, 2);
    $line = $po->items()->first();

    $this->actingAs($user, 'staff')
        ->deleteJson("/api/staff/purchase-orders/{$po->id}/items/{$line->id}")
        ->assertNoContent();

    expect($po->items()->count())->toBe(1);
});

test('removing the last line of a locked purchase order reports the status rule first', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = openOrderWithLines($user->employee->branch_id, 1);
    $po->update(['status' => 'ready_for_delivery']);
    $line = $po->items()->first();

    $this->actingAs($user, 'staff')
        ->deleteJson("/api/staff/purchase-orders/{$po->id}/items/{$line->id}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'This purchase order can no longer be edited.']);
});
