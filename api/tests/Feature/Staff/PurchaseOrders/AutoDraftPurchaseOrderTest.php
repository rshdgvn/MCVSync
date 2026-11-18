<?php

use App\Listeners\DraftPurchaseOrderForLowStock;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PurchaseOrderService;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function draftsAt(User $user)
{
    return PurchaseOrder::withoutGlobalScopes()
        ->where('branch_id', $user->employee->branch_id)
        ->where('status', 'draft')
        ->with('items')
        ->get();
}

function paidBefore(User $user, Item $item, float $unitCost): void
{
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'closed', 'order_date' => '2026-10-01']);
    $po->items()->create(['item_id' => $item->id, 'quantity_ordered' => 1, 'unit_cost' => $unitCost, 'discount' => 0, 'total' => $unitCost]);
}

function pickShortOf(User $main, User $cebu, Item $item, int $stock, int $requested)
{
    stockAt($main, $item, $stock, '2027-01-01', 'B-'.$item->id);

    return makeTransfer($cebu, $main, [$item->id => $requested]);
}

function lowStockDraft(User $user, Item $item): ?PurchaseOrder
{
    return app(PurchaseOrderService::class)->draftForLowStock($item->id, $user->employee->branch_id);
}

test('crossing the reorder point creates a draft for the preferred supplier at the last paid cost', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $supplier = Supplier::factory()->create();
    $gloves = Item::factory()->create(['reorder_point' => 10, 'reorder_quantity' => null, 'preferred_supplier_id' => $supplier->id]);
    paidBefore($main, $gloves, 45);
    $transfer = pickShortOf($main, $cebu, $gloves, 20, 12);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $gloves->id])->assertOk();

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(1);
    expect($drafts[0]->source)->toBe('auto_low_stock');
    expect($drafts[0]->supplier_id)->toBe($supplier->id);
    expect($drafts[0]->prepared_by)->toBeNull();
    expect($drafts[0]->items)->toHaveCount(1);
    expect($drafts[0]->items[0]->quantity_ordered)->toBe(12);
    expect((float) $drafts[0]->items[0]->unit_cost)->toBe(45.0);
});

test('the low stock draft is queued as a listener after commit', function () {
    Queue::fake();
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $gloves = Item::factory()->create(['reorder_point' => 10]);
    $transfer = pickShortOf($main, $cebu, $gloves, 20, 12);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $gloves->id])->assertOk();

    Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $job) => $job->class === DraftPurchaseOrderForLowStock::class);
    expect(draftsAt($main))->toHaveCount(0);
});

test('the reorder quantity wins over the computed quantity and an unbought item starts at zero cost', function () {
    $main = makePurchasingUser('APALIT');
    $syringe = Item::factory()->create(['reorder_point' => 10, 'reorder_quantity' => 50]);

    $draft = lowStockDraft($main, $syringe);

    expect($draft->items()->first()->quantity_ordered)->toBe(50);
    expect((float) $draft->items()->first()->unit_cost)->toBe(0.0);
    expect($draft->supplier_id)->toBeNull();
});

test('the computed quantity is never below one', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create(['reorder_point' => 0, 'reorder_quantity' => null]);
    stockAt($main, $item, 5, '2027-01-01', 'Q-1');

    expect(lowStockDraft($main, $item)->items()->first()->quantity_ordered)->toBe(1);
});

test('a second trigger tops up the same draft instead of duplicating it', function () {
    $main = makePurchasingUser('APALIT');
    $supplier = Supplier::factory()->create();
    $gloves = Item::factory()->create(['reorder_point' => 10, 'reorder_quantity' => 30, 'preferred_supplier_id' => $supplier->id]);
    $masks = Item::factory()->create(['reorder_point' => 5, 'reorder_quantity' => 20, 'preferred_supplier_id' => $supplier->id]);

    lowStockDraft($main, $gloves);
    lowStockDraft($main, $gloves);
    lowStockDraft($main, $masks);

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(1);
    expect($drafts[0]->items->pluck('quantity_ordered', 'item_id')->all())->toBe([$gloves->id => 30, $masks->id => 20]);
});

test('items with different preferred suppliers go to separate drafts and no supplier shares one draft', function () {
    $main = makePurchasingUser('APALIT');
    $first = Item::factory()->create(['reorder_point' => 1, 'preferred_supplier_id' => Supplier::factory()->create()->id]);
    $second = Item::factory()->create(['reorder_point' => 1, 'preferred_supplier_id' => Supplier::factory()->create()->id]);
    $unassigned = Item::factory()->create(['reorder_point' => 1]);
    $alsoUnassigned = Item::factory()->create(['reorder_point' => 1]);

    collect([$first, $second, $unassigned, $alsoUnassigned])->each(fn (Item $item) => lowStockDraft($main, $item));

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(3);
    expect($drafts->firstWhere('supplier_id', null)->items)->toHaveCount(2);
});

test('overlapping low stock and shortage triggers for one item produce one draft line', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $masks = Item::factory()->create(['reorder_point' => 10]);
    $transfer = pickShortOf($main, $cebu, $masks, 3, 8);

    lowStockDraft($main, $masks);
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $masks->id])->assertUnprocessable();
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $masks->id])->assertUnprocessable();

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(1);
    expect($drafts[0]->items)->toHaveCount(1);
    expect($drafts[0]->source)->toBe('auto_low_stock');
});

test('a pick short of stock still returns insufficient stock and drafts the shortage', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $masks = Item::factory()->create(['reorder_point' => null]);
    $transfer = pickShortOf($main, $cebu, $masks, 3, 8);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $masks->id, 'quantity' => 3])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'insufficient_stock')
        ->assertJsonPath('available', 3);

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(1);
    expect($drafts[0]->source)->toBe('auto_shortage');
    expect($drafts[0]->items[0]->quantity_ordered)->toBe(5);
    expect(draftsAt($cebu))->toHaveCount(0);
});

test('a queued offline pick short of stock drafts the shortage even though its transaction rolls back', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $masks = Item::factory()->create();
    $transfer = pickShortOf($main, $cebu, $masks, 3, 8);

    $this->actingAs($main, 'staff')
        ->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $masks->id, 'quantity' => 3], ['Idempotency-Key' => (string) Str::uuid()])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'insufficient_stock');

    expect(draftsAt($main))->toHaveCount(1);
    expect(draftsAt($main)[0]->items[0]->quantity_ordered)->toBe(5);
});

test('finalizing a draft needs a supplier and a cost on every line, then opens it with who finalized it', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create(['reorder_point' => 1]);
    $draft = lowStockDraft($main, $item);
    $supplier = Supplier::factory()->create();

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['supplier_id' => 'Choose a supplier before finalizing this purchase order.']);

    $this->actingAs($main, 'staff')->patchJson("/api/staff/purchase-orders/{$draft->id}", ['supplier_id' => $supplier->id])
        ->assertOk()
        ->assertJsonPath('supplier.id', $supplier->id);

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items']);

    $line = $draft->items()->first();
    $this->actingAs($main, 'staff')->patchJson("/api/staff/purchase-orders/{$draft->id}/items/{$line->id}", ['quantity_ordered' => 4, 'unit_cost' => 12.5])->assertOk();

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")
        ->assertOk()
        ->assertJsonPath('status', 'open')
        ->assertJsonPath('source', 'auto_low_stock')
        ->assertJsonPath('prepared_by', $main->name);

    expect($draft->fresh()->prepared_by)->toBe($main->employee->id);
});

test('a finalized purchase order cannot be finalized again or change supplier', function () {
    $main = makePurchasingUser('APALIT');
    $open = PurchaseOrder::factory()->create(['branch_id' => $main->employee->branch_id, 'status' => 'open']);

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$open->id}/finalize")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Only a draft purchase order can be finalized.']);

    $this->actingAs($main, 'staff')->patchJson("/api/staff/purchase-orders/{$open->id}", ['supplier_id' => Supplier::factory()->create()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['supplier_id']);
});

test('double finalize opens the draft once', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create(['reorder_point' => 1, 'preferred_supplier_id' => Supplier::factory()->create()->id]);
    paidBefore($main, $item, 10);
    $draft = lowStockDraft($main, $item);

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")->assertOk();
    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")->assertUnprocessable();

    expect($draft->fresh()->status)->toBe('open');
});

test('discarding a draft cancels it and the next trigger starts a new draft', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create(['reorder_point' => 1]);
    $draft = lowStockDraft($main, $item);

    $this->actingAs($main, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/cancel")
        ->assertOk()
        ->assertJsonPath('status', 'cancelled');

    $next = lowStockDraft($main, $item);

    expect($next->id)->not->toBe($draft->id);
    expect(draftsAt($main))->toHaveCount(1);
});

test('drafts list under their own count and can be found by item', function () {
    $main = makePurchasingUser('APALIT');
    $gloves = Item::factory()->create(['reorder_point' => 1]);
    $masks = Item::factory()->create(['reorder_point' => 1, 'preferred_supplier_id' => Supplier::factory()->create()->id]);
    $glovesDraft = lowStockDraft($main, $gloves);
    lowStockDraft($main, $masks);

    $this->actingAs($main, 'staff')->getJson("/api/staff/purchase-orders?status=draft&item_id={$gloves->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $glovesDraft->id)
        ->assertJsonPath('data.0.supplier', null)
        ->assertJsonPath('data.0.source', 'auto_low_stock')
        ->assertJsonPath('counts.draft', 2);
});

test('another branch cannot see or finalize a draft', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $draft = lowStockDraft($main, Item::factory()->create(['reorder_point' => 1, 'preferred_supplier_id' => Supplier::factory()->create()->id]));

    $this->actingAs($cebu, 'staff')->getJson("/api/staff/purchase-orders/{$draft->id}")->assertNotFound();
    $this->actingAs($cebu, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")->assertNotFound();
    $this->actingAs($cebu, 'staff')->getJson('/api/staff/purchase-orders?status=draft')->assertJsonPath('counts.draft', 0);

    expect($draft->fresh()->status)->toBe('draft');
});

test('roles without inventory access cannot finalize a draft', function () {
    $main = makePurchasingUser('APALIT');
    $sales = assignStaffRole(makeStaffUser([], 'APALIT'), 'sales');
    $draft = lowStockDraft($main, Item::factory()->create(['reorder_point' => 1]));

    $this->actingAs($sales, 'staff')->postJson("/api/staff/purchase-orders/{$draft->id}/finalize")->assertForbidden();
});

test('an item records its preferred supplier and rejects an inactive one', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    $supplier = Supplier::factory()->create();
    $inactive = Supplier::factory()->create(['is_active' => false]);
    $payload = fn (?int $supplierId) => [
        'name' => $item->name, 'sku' => $item->sku, 'category_id' => $item->category_id, 'unit_id' => $item->unit_id,
        'reorder_point' => 10, 'reorder_quantity' => 40, 'preferred_supplier_id' => $supplierId,
    ];

    $this->actingAs($main, 'staff')->patchJson("/api/staff/inventory/items/{$item->id}", $payload($supplier->id))
        ->assertOk()
        ->assertJsonPath('preferred_supplier.id', $supplier->id)
        ->assertJsonPath('reorder_quantity', 40);

    $this->actingAs($main, 'staff')->patchJson("/api/staff/inventory/items/{$item->id}", $payload($inactive->id))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['preferred_supplier_id']);
});

function incoming(User $user, Item $item, string $status, int $ordered, int $received = 0, ?int $branchId = null): void
{
    $po = PurchaseOrder::factory()->create(['branch_id' => $branchId ?? $user->employee->branch_id, 'status' => $status]);
    $po->items()->create([
        'item_id' => $item->id, 'quantity_ordered' => $ordered, 'quantity_received' => $received,
        'unit_cost' => 10, 'discount' => 0, 'total' => $ordered * 10,
    ]);
}

test('a low stock draft orders only what open and ready purchase orders do not already bring in', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $gloves = Item::factory()->create(['reorder_point' => 10, 'reorder_quantity' => 30]);
    incoming($main, $gloves, 'open', 20, 5);
    incoming($main, $gloves, 'ready_for_delivery', 6);
    incoming($main, $gloves, 'closed', 50, 50);
    incoming($main, $gloves, 'cancelled', 50);
    incoming($main, $gloves, 'draft', 50);
    incoming($main, $gloves, 'open', 50, 0, $cebu->employee->branch_id);

    expect(lowStockDraft($main, $gloves)->items()->first()->quantity_ordered)->toBe(9);
});

test('no low stock draft is made when incoming stock already covers the reorder', function () {
    $main = makePurchasingUser('APALIT');
    $gloves = Item::factory()->create(['reorder_point' => 10, 'reorder_quantity' => 30]);
    incoming($main, $gloves, 'open', 30);

    expect(lowStockDraft($main, $gloves))->toBeNull();
    expect(draftsAt($main))->toHaveCount(0);
});

test('a shortage draft covers only the shortfall beyond incoming stock, and none when it is covered', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $masks = Item::factory()->create();
    $syringes = Item::factory()->create();
    incoming($main, $masks, 'ready_for_delivery', 3);
    incoming($main, $syringes, 'open', 8, 3);
    $masksTransfer = pickShortOf($main, $cebu, $masks, 3, 8);
    $syringesTransfer = pickShortOf($main, $cebu, $syringes, 3, 8);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$masksTransfer->id}/fulfill/match", ['item_id' => $masks->id])->assertUnprocessable();
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$syringesTransfer->id}/fulfill/match", ['item_id' => $syringes->id])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'insufficient_stock');

    $drafts = draftsAt($main);
    expect($drafts)->toHaveCount(1);
    expect($drafts[0]->items->pluck('quantity_ordered', 'item_id')->all())->toBe([$masks->id => 2]);
});
