<?php

use App\Models\Branch;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\Supplier;

test('purchasing can create a purchase order with an initial item table', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $branch = $user->employee->branch;
    $supplier = Supplier::factory()->create();
    $item = Item::factory()->create();

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', [
        'supplier_id' => $supplier->id,
        'branch_id' => $branch->id,
        'terms' => '30 Days',
        'items' => [
            ['item_id' => $item->id, 'quantity_ordered' => 10, 'unit_cost' => 25.50, 'discount' => 5],
        ],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('status', 'open');
    $response->assertJsonPath('po_number', 'PO-0001');
    $response->assertJsonPath('prepared_by', $user->name);
    $response->assertJsonPath('items.0.quantity_ordered', 10);
    $response->assertJsonPath('items.0.total', 250);
    $response->assertJsonPath('total', 250);
});

test('po numbers are sequential across purchase orders', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $branch = $user->employee->branch;
    $supplier = Supplier::factory()->create();
    $item = Item::factory()->create();

    $payload = fn () => [
        'supplier_id' => $supplier->id,
        'branch_id' => $branch->id,
        'items' => [['item_id' => $item->id, 'quantity_ordered' => 1, 'unit_cost' => 10]],
    ];

    $first = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', $payload());
    $second = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', $payload());

    expect($first->json('po_number'))->toBe('PO-0001');
    expect($second->json('po_number'))->toBe('PO-0002');
});

test('prepared_by is always the acting employee, never client-controllable', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $branch = $user->employee->branch;
    $supplier = Supplier::factory()->create();
    $item = Item::factory()->create();

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', [
        'supplier_id' => $supplier->id,
        'branch_id' => $branch->id,
        'prepared_by' => 999999,
        'items' => [['item_id' => $item->id, 'quantity_ordered' => 1, 'unit_cost' => 10]],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('prepared_by', $user->name);
});

test('creating a purchase order requires at least one item', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    $branch = $user->employee->branch;
    $supplier = Supplier::factory()->create();

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', [
        'supplier_id' => $supplier->id,
        'branch_id' => $branch->id,
        'items' => [],
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('items');
});

test('admin and super admin have full access, sales accounting and logistics have none', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');
    $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders')->assertOk();

    $superAdmin = makeStaffUser([], 'APALIT');
    assignStaffRole($superAdmin, 'super_admin');
    $this->actingAs($superAdmin, 'staff')->getJson('/api/staff/purchase-orders')->assertOk();

    foreach (['sales', 'accounting', 'logistics'] as $role) {
        $user = makeStaffUser([], 'APALIT');
        assignStaffRole($user, $role);
        $this->actingAs($user, 'staff')->getJson('/api/staff/purchase-orders')->assertForbidden();
    }
});

test('a branch scoped purchasing user only sees purchase orders for their own branch', function () {
    $apalit = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);

    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $ownPo = PurchaseOrder::factory()->create(['branch_id' => $apalit->id]);
    PurchaseOrder::factory()->create(['branch_id' => $cebu->id]);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/purchase-orders');

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($ownPo->id)->toHaveCount(1);
});

test('admin sees purchase orders across every branch', function () {
    $apalit = Branch::firstOrCreate(['code' => 'APALIT'], ['name' => 'Apalit', 'address' => 'Apalit', 'is_main' => true]);
    $cebu = Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);

    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    PurchaseOrder::factory()->create(['branch_id' => $apalit->id]);
    PurchaseOrder::factory()->create(['branch_id' => $cebu->id]);

    $response = $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders');

    expect($response->json('data'))->toHaveCount(2);
});

test('purchase orders list is filterable by status, supplier, and branch', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    $supplierA = Supplier::factory()->create();
    $supplierB = Supplier::factory()->create();
    $branchA = Branch::factory()->create();
    $branchB = Branch::factory()->create();

    $open = PurchaseOrder::factory()->create(['status' => 'open', 'supplier_id' => $supplierA->id, 'branch_id' => $branchA->id]);
    $cancelled = PurchaseOrder::factory()->create(['status' => 'cancelled', 'supplier_id' => $supplierB->id, 'branch_id' => $branchB->id]);

    $byStatus = $this->actingAs($admin, 'staff')->getJson('/api/staff/purchase-orders?status=cancelled');
    expect(collect($byStatus->json('data'))->pluck('id'))->toContain($cancelled->id)->not->toContain($open->id);

    $bySupplier = $this->actingAs($admin, 'staff')->getJson("/api/staff/purchase-orders?supplier_id={$supplierA->id}");
    expect(collect($bySupplier->json('data'))->pluck('id'))->toContain($open->id)->not->toContain($cancelled->id);

    $byBranch = $this->actingAs($admin, 'staff')->getJson("/api/staff/purchase-orders?branch_id={$branchB->id}");
    expect(collect($byBranch->json('data'))->pluck('id'))->toContain($cancelled->id)->not->toContain($open->id);
});

test('purchase order detail includes line items and a computed total', function () {
    $admin = makeStaffUser([], 'APALIT');
    assignStaffRole($admin, 'admin');

    $po = PurchaseOrder::factory()->create();
    $po->items()->create([
        'item_id' => Item::factory()->create()->id,
        'quantity_ordered' => 4,
        'unit_cost' => 100,
        'discount' => 0,
        'total' => 400,
    ]);

    $response = $this->actingAs($admin, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}");

    $response->assertOk();
    expect($response->json('items'))->toHaveCount(1);
    $response->assertJsonPath('total', 400);
});
