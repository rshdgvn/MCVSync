<?php

use App\Models\Branch;
use App\Models\Item;
use App\Models\PurchaseOrder;

test('marking an open purchase order ready for delivery succeeds', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/mark-ready");

    $response->assertOk();
    $response->assertJsonPath('status', 'ready_for_delivery');
});

test('marking a draft purchase order ready for delivery is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'draft']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/mark-ready");

    $response->assertUnprocessable();
    expect($po->fresh()->status)->toBe('draft');
});

test('cancelling is allowed from draft, open, and ready_for_delivery', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    foreach (['draft', 'open', 'ready_for_delivery'] as $status) {
        $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => $status]);

        $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/cancel");

        $response->assertOk();
        $response->assertJsonPath('status', 'cancelled');
    }
});

test('a closed purchase order cannot be cancelled', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'closed']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/cancel");

    $response->assertUnprocessable();
    expect($po->fresh()->status)->toBe('closed');
});

test('header fields can be edited while open but not once ready_for_delivery', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $openPo = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $this->actingAs($user, 'staff')
        ->patchJson("/api/staff/purchase-orders/{$openPo->id}", ['remarks' => 'Updated remarks'])
        ->assertOk()
        ->assertJsonPath('remarks', 'Updated remarks');

    $readyPo = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'ready_for_delivery']);
    $this->actingAs($user, 'staff')
        ->patchJson("/api/staff/purchase-orders/{$readyPo->id}", ['remarks' => 'Should not apply'])
        ->assertUnprocessable();
    expect($readyPo->fresh()->remarks)->not->toBe('Should not apply');
});

test('line items can be added, edited, and removed while open', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();

    $add = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/items", [
        'item_id' => $item->id,
        'quantity_ordered' => 5,
        'unit_cost' => 20,
        'discount' => 2,
    ]);
    $add->assertCreated();
    $add->assertJsonPath('total', 98);
    $lineId = $add->json('id');

    $edit = $this->actingAs($user, 'staff')->patchJson("/api/staff/purchase-orders/{$po->id}/items/{$lineId}", [
        'quantity_ordered' => 10,
        'unit_cost' => 20,
        'discount' => 0,
    ]);
    $edit->assertOk();
    $edit->assertJsonPath('total', 200);

    $this->actingAs($user, 'staff')
        ->deleteJson("/api/staff/purchase-orders/{$po->id}/items/{$lineId}")
        ->assertNoContent();

    expect($po->items()->count())->toBe(0);
});

test('line items cannot be added, edited, or removed once ready_for_delivery', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'ready_for_delivery']);
    $item = Item::factory()->create();

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/items", [
        'item_id' => $item->id,
        'quantity_ordered' => 5,
        'unit_cost' => 20,
    ])->assertUnprocessable();

    $existingLine = $po->items()->create([
        'item_id' => $item->id, 'quantity_ordered' => 1, 'unit_cost' => 10, 'discount' => 0, 'total' => 10,
    ]);

    $this->actingAs($user, 'staff')
        ->patchJson("/api/staff/purchase-orders/{$po->id}/items/{$existingLine->id}", [
            'quantity_ordered' => 2, 'unit_cost' => 10,
        ])->assertUnprocessable();

    $this->actingAs($user, 'staff')
        ->deleteJson("/api/staff/purchase-orders/{$po->id}/items/{$existingLine->id}")
        ->assertUnprocessable();
});

test('a line item cannot be accessed through a purchase order it does not belong to', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $poA = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $poB = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create();

    $line = $poA->items()->create([
        'item_id' => $item->id, 'quantity_ordered' => 1, 'unit_cost' => 10, 'discount' => 0, 'total' => 10,
    ]);

    $this->actingAs($user, 'staff')
        ->patchJson("/api/staff/purchase-orders/{$poB->id}/items/{$line->id}", [
            'quantity_ordered' => 2, 'unit_cost' => 10,
        ])
        ->assertNotFound();
});

test('a branch scoped purchasing user cannot open another branch purchase order by id', function () {
    $cebuUser = makePurchasingUser('CEBU');
    $apalit = Branch::factory()->create(['code' => 'APALIT', 'is_main' => true]);
    $po = PurchaseOrder::factory()->create(['branch_id' => $apalit->id, 'status' => 'open']);

    $this->actingAs($cebuUser, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}")->assertNotFound();
    $this->actingAs($cebuUser, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/complete")->assertNotFound();
});
