<?php

use App\Models\Branch;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\Supplier;

function addPurchaseOrderLine(PurchaseOrder $po, int $quantity, float $unitCost): void
{
    $po->items()->create([
        'item_id' => Item::factory()->create()->id,
        'quantity_ordered' => $quantity,
        'unit_cost' => $unitCost,
        'discount' => 0,
        'total' => $quantity * $unitCost,
    ]);
}

function purchaseOrderPayload(Supplier $supplier, Branch $branch, Item $item): array
{
    return [
        'supplier_id' => $supplier->id,
        'branch_id' => $branch->id,
        'items' => [['item_id' => $item->id, 'quantity_ordered' => 2, 'unit_cost' => 10]],
    ];
}

test('the purchase orders list returns each order total and line count', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    $po = PurchaseOrder::factory()->create();
    addPurchaseOrderLine($po, 4, 100);
    addPurchaseOrderLine($po, 2, 25.5);
    $empty = PurchaseOrder::factory()->create();

    $response = $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders');

    $response->assertOk();
    $rows = collect($response->json('data'))->keyBy('id');
    expect($rows[$po->id]['total'])->toEqual(451);
    expect($rows[$po->id]['items_count'])->toBe(2);
    expect($rows[$po->id])->not->toHaveKey('items');
    expect($rows[$empty->id]['total'])->toEqual(0);
    expect($rows[$empty->id]['items_count'])->toBe(0);
});

test('the purchase orders list is searchable by po number and supplier name', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    $acme = PurchaseOrder::factory()->create([
        'po_number' => 'PO-0101',
        'supplier_id' => Supplier::factory()->create(['name' => 'Acme Medical'])->id,
    ]);
    $globex = PurchaseOrder::factory()->create([
        'po_number' => 'PO-0202',
        'supplier_id' => Supplier::factory()->create(['name' => 'Globex Pharma'])->id,
    ]);

    $byNumber = $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders?search=0202');
    expect(collect($byNumber->json('data'))->pluck('id')->all())->toBe([$globex->id]);

    $bySupplier = $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders?search=acme');
    expect(collect($bySupplier->json('data'))->pluck('id')->all())->toBe([$acme->id]);
});

test('status counts follow the search and supplier filters but not the status filter', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');
    $supplier = Supplier::factory()->create();

    PurchaseOrder::factory()->create(['status' => 'open', 'supplier_id' => $supplier->id]);
    PurchaseOrder::factory()->create(['status' => 'open', 'supplier_id' => $supplier->id]);
    PurchaseOrder::factory()->create(['status' => 'ready_for_delivery', 'supplier_id' => $supplier->id]);
    PurchaseOrder::factory()->create(['status' => 'cancelled']);

    $response = $this->actingAs($admin, 'staff')
        ->getJson("/api/staff/purchase-orders?supplier_id={$supplier->id}&status=open");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
    $response->assertJsonPath('counts', [
        'all' => 3,
        'draft' => 0,
        'open' => 2,
        'ready_for_delivery' => 1,
        'closed' => 0,
        'cancelled' => 0,
    ]);
});

test('status counts for a branch scoped user only include their own branch', function () {
    $apalit = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    PurchaseOrder::factory()->create(['status' => 'open', 'branch_id' => $apalit->id]);
    PurchaseOrder::factory()->create(['status' => 'open', 'branch_id' => $cebu->id]);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/purchase-orders');

    $response->assertJsonPath('counts.all', 1);
    $response->assertJsonPath('counts.open', 1);
});

test('a branch scoped purchasing user cannot create a purchase order for another branch', function () {
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $response = $this->actingAs($user, 'staff')->postJson(
        '/api/staff/purchase-orders',
        purchaseOrderPayload(Supplier::factory()->create(), $cebu, Item::factory()->create()),
    );

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['branch_id' => 'You can only create purchase orders for your own branch.']);
    expect(PurchaseOrder::withoutGlobalScopes()->count())->toBe(0);
});

test('admin and super admin can create a purchase order for any branch', function () {
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);

    foreach (['admin', 'super_admin'] as $role) {
        $user = makeStaffUser([], 'APALIT');
        assignStaffRole($user, $role);

        $this->actingAs($user, 'staff')
            ->postJson('/api/staff/purchase-orders', purchaseOrderPayload(Supplier::factory()->create(), $cebu, Item::factory()->create()))
            ->assertCreated()
            ->assertJsonPath('branch.id', $cebu->id);
    }
});

test('a purchase order cannot be created for an inactive supplier or with an inactive item', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $branch = $user->employee->branch;

    $inactiveSupplier = $this->actingAs($user, 'staff')->postJson(
        '/api/staff/purchase-orders',
        purchaseOrderPayload(Supplier::factory()->create(['is_active' => false]), $branch, Item::factory()->create()),
    );
    $inactiveSupplier->assertUnprocessable();
    $inactiveSupplier->assertJsonValidationErrors(['supplier_id' => 'Choose an active supplier.']);

    $inactiveItem = $this->actingAs($user, 'staff')->postJson(
        '/api/staff/purchase-orders',
        purchaseOrderPayload(Supplier::factory()->create(), $branch, Item::factory()->create(['is_active' => false])),
    );
    $inactiveItem->assertUnprocessable();
    $inactiveItem->assertJsonValidationErrors(['items.0.item_id' => 'Choose an active item.']);

    expect(PurchaseOrder::withoutGlobalScopes()->count())->toBe(0);
});

test('an inactive item cannot be added as a new line', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $po = PurchaseOrder::factory()->create(['status' => 'open', 'branch_id' => $user->employee->branch_id]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/items", [
        'item_id' => Item::factory()->create(['is_active' => false])->id,
        'quantity_ordered' => 1,
        'unit_cost' => 5,
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['item_id' => 'Choose an active item.']);
    expect($po->items()->count())->toBe(0);
});

test('an existing purchase order still shows a supplier deactivated after it was created', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');
    $supplier = Supplier::factory()->create();
    $po = PurchaseOrder::factory()->create(['supplier_id' => $supplier->id]);
    $supplier->update(['is_active' => false]);

    $this->actingAs($admin, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}")
        ->assertOk()
        ->assertJsonPath('supplier.id', $supplier->id)
        ->assertJsonPath('supplier.is_active', false);
});
