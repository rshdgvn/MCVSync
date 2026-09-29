<?php

use App\Events\LowStockThresholdCrossed;
use App\Events\StockLevelChanged;
use App\Models\Batch;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDiscrepancy;
use App\Models\StockTransaction;
use Illuminate\Support\Facades\Event;

function poWithLine(string $branchCode = 'APALIT', int $ordered = 10, int $received = 0): array
{
    $user = makeStaffUser([], $branchCode);
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create(['has_expiry' => true]);
    $line = $po->items()->create([
        'item_id' => $item->id, 'quantity_ordered' => $ordered, 'quantity_received' => $received,
        'unit_cost' => 10, 'discount' => 0, 'total' => $ordered * 10,
    ]);

    return [$po, $item, $line];
}

test('confirming a receipt creates a new batch, writes a stock transaction, and increments quantity_received', function () {
    Event::fake([StockLevelChanged::class]);

    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT');
    $po->update(['branch_id' => $user->employee->branch_id]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id,
        'quantity_received' => 6,
        'batch_number' => 'BATCH-001',
        'expiry_date' => now()->addYear()->toDateString(),
    ]);

    $response->assertOk();
    $response->assertJsonPath('quantity_received', 6);

    $batch = Batch::where('batch_number', 'BATCH-001')->first();
    expect($batch)->not->toBeNull();
    expect($batch->quantity)->toBe(6);
    expect($batch->item_id)->toBe($item->id);

    expect(StockTransaction::where('batch_id', $batch->id)->where('type', 'receive')->where('quantity', 6)->exists())->toBeTrue();

    Event::assertDispatched(StockLevelChanged::class, fn (StockLevelChanged $event) => $event->itemId === $item->id && $event->available === 6);
    Event::assertNotDispatched(LowStockThresholdCrossed::class);
});

test('confirming again against the same batch number increments it rather than creating a second batch', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT', 20);
    $po->update(['branch_id' => $user->employee->branch_id]);
    $expiry = now()->addYear()->toDateString();

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-002', 'expiry_date' => $expiry,
    ])->assertOk();

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 3, 'batch_number' => 'BATCH-002', 'expiry_date' => $expiry,
    ])->assertOk();

    expect(Batch::where('batch_number', 'BATCH-002')->count())->toBe(1);
    expect(Batch::where('batch_number', 'BATCH-002')->first()->quantity)->toBe(8);
    expect($line->fresh()->quantity_received)->toBe(8);
});

test('confirming an existing batch number with a different expiry date is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT', 20);
    $po->update(['branch_id' => $user->employee->branch_id]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-003',
        'expiry_date' => '2027-01-01',
    ])->assertOk();

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-003',
        'expiry_date' => '2027-06-01',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('expiry_date');
    expect(Batch::where('batch_number', 'BATCH-003')->first()->quantity)->toBe(5);
});

test('expiry date is required for an item with has_expiry true', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT');
    $po->update(['branch_id' => $user->employee->branch_id]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-004',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('expiry_date');
});

test('expiry date is not required for an item with has_expiry false', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');

    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create(['has_expiry' => false]);
    $line = $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 10, 'unit_cost' => 10, 'discount' => 0, 'total' => 100]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-005',
    ]);

    $response->assertOk();
    expect(Batch::where('batch_number', 'BATCH-005')->first()->expiry_date)->toBeNull();
});

test('receiving more than ordered immediately logs an over discrepancy', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT', 5);
    $po->update(['branch_id' => $user->employee->branch_id]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 8, 'batch_number' => 'BATCH-006',
        'expiry_date' => now()->addYear()->toDateString(),
    ])->assertOk();

    $discrepancy = PurchaseOrderDiscrepancy::where('purchase_order_item_id', $line->id)->where('type', 'over')->first();
    expect($discrepancy)->not->toBeNull();
    expect($discrepancy->scanned_quantity)->toBe(8);
});

test('confirming receipt against a closed purchase order is rejected', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$po, $item, $line] = poWithLine('APALIT');
    $po->update(['branch_id' => $user->employee->branch_id, 'status' => 'closed']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
        'purchase_order_item_id' => $line->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-007',
        'expiry_date' => now()->addYear()->toDateString(),
    ])->assertUnprocessable();
});

test('a line item from a different purchase order cannot be confirmed against this one', function () {
    $user = makeStaffUser([], 'APALIT');
    assignStaffRole($user, 'purchasing');
    [$poA] = poWithLine('APALIT');
    [$poB, , $lineB] = poWithLine('APALIT');
    $poA->update(['branch_id' => $user->employee->branch_id]);
    $poB->update(['branch_id' => $user->employee->branch_id]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$poA->id}/receive/confirm", [
        'purchase_order_item_id' => $lineB->id, 'quantity_received' => 5, 'batch_number' => 'BATCH-008',
        'expiry_date' => now()->addYear()->toDateString(),
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('purchase_order_item_id');
});
