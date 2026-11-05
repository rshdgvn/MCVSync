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

test('a discount above the line subtotal is rejected when creating a purchase order', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', [
        'supplier_id' => Supplier::factory()->create()->id,
        'branch_id' => $user->employee->branch_id,
        'items' => [
            ['item_id' => Item::factory()->create()->id, 'quantity_ordered' => 2, 'unit_cost' => 10, 'discount' => 20],
            ['item_id' => Item::factory()->create()->id, 'quantity_ordered' => 2, 'unit_cost' => 10, 'discount' => 20.01],
        ],
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['items.1.discount' => 'The discount can\'t be more than the line subtotal (quantity × unit cost).']);
    $response->assertJsonMissingValidationErrors(['items.0.discount']);
    expect(PurchaseOrder::withoutGlobalScopes()->count())->toBe(0);
});

test('a discount above the line subtotal is rejected when adding or editing a line', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = openOrderWithLines($user->employee->branch_id, 1);
    $line = $po->items()->first();

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/purchase-orders/{$po->id}/items", [
            'item_id' => Item::factory()->create()->id,
            'quantity_ordered' => 3,
            'unit_cost' => 5,
            'discount' => 16,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['discount']);

    $this->actingAs($user, 'staff')
        ->patchJson("/api/staff/purchase-orders/{$po->id}/items/{$line->id}", [
            'quantity_ordered' => 2,
            'unit_cost' => 10,
            'discount' => 25,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['discount']);

    expect($po->items()->count())->toBe(1);
    expect((float) $line->fresh()->discount)->toEqual(0.0);
});

test('a discount equal to the line subtotal is allowed and gives a zero line total', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = openOrderWithLines($user->employee->branch_id, 1);

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/purchase-orders/{$po->id}/items", [
            'item_id' => Item::factory()->create()->id,
            'quantity_ordered' => 3,
            'unit_cost' => 5,
            'discount' => 15,
        ])
        ->assertCreated()
        ->assertJsonPath('total', 0);
});
