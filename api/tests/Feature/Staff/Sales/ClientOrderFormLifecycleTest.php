<?php

use App\Events\StockLevelChanged;
use App\Models\Batch;
use App\Models\ClientOrderForm;
use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\StockTransaction;
use App\Services\StockAvailabilityService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

function requestAndConfirmCancellation($test, $clientUser, $confirmer, ClientOrderForm $cof)
{
    $test->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")->assertOk();

    return $test->actingAs($confirmer, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/cancellation/confirm");
}

function batchQuantity(string $batchNumber): int
{
    return Batch::withoutGlobalScopes()->where('batch_number', $batchNumber)->value('quantity');
}

function cofTransactions(ClientOrderForm $cof, string $type)
{
    return StockTransaction::withoutGlobalScopes()
        ->where('reference_type', 'client_order_form')
        ->where('reference_id', $cof->id)
        ->where('type', $type);
}

function cofPick($test, $picker, ClientOrderForm $cof, Item $item, int $quantity, array $headers = [])
{
    return $test->actingAs($picker, 'staff')->postJson(
        "/api/staff/client-order-forms/{$cof->id}/fulfill/pick",
        ['item_id' => $item->id, 'quantity' => $quantity],
        $headers,
    );
}

test('forwarding is blocked until every line is priced and reserves nothing', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $priced = Item::factory()->create();
    $unpriced = Item::factory()->create(['name' => 'Face Shield']);
    priceFor($clientUser, $priced, 50, $sales);
    $cof = portalOrder($this, $clientUser, [$priced->id => 2, $unpriced->id => 1]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items' => 'Accounting has not priced every item for this client yet: Face Shield.']);

    expect($cof->fresh()->order_status)->toBe('pending_approval');
    expect(orderReservations($cof)->count())->toBe(0);
});

test('forwarding snapshots prices with the line discount, reserves stock and records who prepared it', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    priceFor($clientUser, $item, 200, $sales);
    $cof = portalOrder($this, $clientUser, [$item->id => 5]);
    $cof->items()->update(['discount_percent' => 10]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")
        ->assertOk()
        ->assertJsonPath('order_status', 'processing')
        ->assertJsonPath('prepared_by', $sales->name)
        ->assertJsonPath('items.0.unit_cost', 200)
        ->assertJsonPath('items.0.total', 900);

    expect(orderReservations($cof)->where('status', 'active')->sum('quantity'))->toBe(5);

    priceFor($clientUser, $item, 999, $sales);
    expect((float) $cof->items()->value('unit_cost'))->toBe(200.0);
});

test('forwarding twice moves the order once', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")->assertUnprocessable();

    expect(orderReservations($cof)->sum('quantity'))->toBe(5);
});

test('forwarding without enough stock fails, reserves nothing and drafts a supplier PO for the shortfall', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 3, '2027-06-30', 'B-1');
    priceFor($clientUser, $item, 50, $sales);
    $cof = portalOrder($this, $clientUser, [$item->id => 8]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'insufficient_stock')
        ->assertJsonPath('available', 3);

    expect($cof->fresh()->order_status)->toBe('pending_approval');
    expect(orderReservations($cof)->count())->toBe(0);
    $draft = PurchaseOrder::withoutGlobalScopes()->where('status', 'draft')->with('items')->sole();
    expect($draft->source)->toBe('auto_shortage');
    expect($draft->items[0]->quantity_ordered)->toBe(5);
});

test('a sales role without the forward permission cannot forward', function () {
    makeSalesUser();
    $junior = assignStaffRole(makeStaffUser([], 'APALIT'), 'sales');
    \Spatie\Permission\Models\Role::findByName('sales', 'staff')->revokePermissionTo('cof.forward_to_purchasing');
    app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    $cof = portalOrder($this, makeClientUser(), [Item::factory()->create()->id => 1]);

    $this->actingAs($junior->fresh(), 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")->assertForbidden();
});

test('purchasing picks a COF with FEFO issue transactions and the last pick makes it ready for delivery with a DR number', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    stockAt($sales, $gloves, 4, '2027-01-31', 'G-EARLY');
    stockAt($sales, $gloves, 20, '2027-09-30', 'G-LATE');
    stockAt($sales, $masks, 10, '2027-06-30', 'M-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$gloves->id => 6, $masks->id => 2]);

    $this->actingAs($picker, 'staff')->getJson('/api/staff/client-order-forms/fulfillment-queue')
        ->assertOk()
        ->assertJsonPath('data.0.cof_number', $cof->cof_number)
        ->assertJsonMissingPath('data.0.items.0.unit_cost');

    cofPick($this, $picker, $cof, $gloves, 4)->assertOk()->assertJsonPath('order_status', 'processing');
    cofPick($this, $picker, $cof, $gloves, 2)->assertOk();
    cofPick($this, $picker, $cof, $masks, 2)->assertOk()->assertJsonPath('order_status', 'ready_for_delivery');

    $issued = StockTransaction::withoutGlobalScopes()->where('reference_type', 'client_order_form')->where('reference_id', $cof->id)->get();
    expect($issued->pluck('type')->unique()->all())->toBe(['issue']);
    expect($issued->sum('quantity'))->toBe(-8);
    expect(orderReservations($cof)->where('status', 'active')->count())->toBe(0);
    expect($cof->fresh()->dr_number)->toBe('DR-0001');
});

test('a queued offline pick sent twice with one key is applied once', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);
    $key = (string) Str::uuid();

    cofPick($this, $picker, $cof, $item, 2, ['Idempotency-Key' => $key])->assertOk();
    cofPick($this, $picker, $cof, $item, 2, ['Idempotency-Key' => $key])->assertOk();

    expect($cof->items()->value('quantity_picked'))->toBe(2);
});

test('only the fulfilling branch and inventory roles can pick a COF', function () {
    $sales = makeSalesUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);

    cofPick($this, makePurchasingUser('CEBU'), $cof, $item, 1)->assertNotFound();
    cofPick($this, $sales, $cof, $item, 1)->assertForbidden();

    expect($cof->items()->value('quantity_picked'))->toBe(0);
});

test('completing picking with a short line logs a discrepancy and sends the order to dispatch approval', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();

    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete")
        ->assertOk()
        ->assertJsonPath('order_status', 'processing');

    $discrepancy = Discrepancy::where('reference_type', 'client_order_form')->sole();
    expect([$discrepancy->type, $discrepancy->scanned_quantity, $discrepancy->resolved])->toBe(['short', 3, false]);

    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-order-forms/dispatch-queue')
        ->assertOk()
        ->assertJsonPath('data.0.id', $cof->id)
        ->assertJsonPath('data.0.open_discrepancies_count', 1);

    $this->actingAs($picker, 'staff')->getJson('/api/staff/discrepancies')->assertJsonPath('counts.all', 0);
});

test('approving dispatch accepts the shortfall, releases the leftover reservation and bills what was picked', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5], 100);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();
    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete")->assertOk();

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve", ['note' => 'Client agreed to 3.'])
        ->assertOk()
        ->assertJsonPath('order_status', 'ready_for_delivery')
        ->assertJsonPath('checked_by', $sales->name)
        ->assertJsonPath('dr_number', 'DR-0001')
        ->assertJsonPath('total', 300);

    $discrepancy = Discrepancy::where('reference_type', 'client_order_form')->sole();
    expect([$discrepancy->resolved, $discrepancy->resolution, $discrepancy->resolution_note])->toBe([true, 'accepted', 'Client agreed to 3.']);
    expect(orderReservations($cof)->where('status', 'active')->count())->toBe(0);
});

test('a dispatch hold keeps the order in the queue with its note until it is approved', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();
    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete")->assertOk();

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/hold")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['note']);
    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/hold", ['note' => 'Asking the client first.'])
        ->assertOk()
        ->assertJsonPath('dispatch_hold.note', 'Asking the client first.')
        ->assertJsonPath('dispatch_hold.held_by', $sales->name);
    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-order-forms/dispatch-queue')->assertJsonPath('data.0.dispatch_hold.note', 'Asking the client first.');

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve")
        ->assertOk()
        ->assertJsonPath('dispatch_hold', null);
});

test('dispatch approval needs an open discrepancy, something picked and the permission', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'This order has no open discrepancy to approve.']);

    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete")->assertOk();

    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve")->assertForbidden();
    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/dispatch/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
});

test('a confirmed cancellation request releases the reservation, and a declined one keeps the order', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cancelled = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    $kept = forwardedOrder($this, $sales, $clientUser, [$item->id => 2]);

    foreach ([$cancelled, $kept] as $cof) {
        $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")
            ->assertOk()
            ->assertJsonPath('cancellation_requested', true);
    }
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$kept->id}/request-cancellation")->assertUnprocessable();

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cancelled->id}/cancellation/confirm")
        ->assertOk()
        ->assertJsonPath('order_status', 'cancelled');
    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$kept->id}/cancellation/decline")
        ->assertOk()
        ->assertJsonPath('order_status', 'processing')
        ->assertJsonPath('cancellation_requested', false);

    expect(orderReservations($cancelled)->where('status', 'active')->count())->toBe(0);
    expect(orderReservations($kept)->where('status', 'active')->sum('quantity'))->toBe(2);
});

test('cancelling a partly picked order returns the picked stock to its batch and releases the rest', function () {
    $sales = makeSalesUser();
    grantRolePermission('cof.confirm_cancellation', ['purchasing']);
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();
    expect(batchQuantity('B-1'))->toBe(17);

    requestAndConfirmCancellation($this, $clientUser, $picker, $cof)
        ->assertOk()
        ->assertJsonPath('order_status', 'cancelled')
        ->assertJsonPath('cancellation_requested', false)
        ->assertJsonPath('items.0.quantity_picked', 0);

    expect(batchQuantity('B-1'))->toBe(20);
    expect(app(StockAvailabilityService::class)->available($item->id, $sales->employee->branch_id))->toBe(20);
    expect(cofTransactions($cof, 'cancel_return')->sum('quantity'))->toBe(3);
    expect(cofTransactions($cof, 'issue')->sum('quantity'))->toBe(-3);
    expect(orderReservations($cof)->where('status', 'active')->count())->toBe(0);
});

test('cancelling a fully picked order returns every batch it was picked from and voids the DR number', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    stockAt($sales, $gloves, 4, '2027-01-31', 'G-EARLY');
    stockAt($sales, $gloves, 20, '2027-09-30', 'G-LATE');
    stockAt($sales, $masks, 10, '2027-06-30', 'M-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$gloves->id => 6, $masks->id => 2]);
    cofPick($this, $picker, $cof, $gloves, 4)->assertOk();
    cofPick($this, $picker, $cof, $gloves, 2)->assertOk();
    cofPick($this, $picker, $cof, $masks, 2)->assertOk()->assertJsonPath('order_status', 'ready_for_delivery');
    expect($cof->fresh()->dr_number)->toBe('DR-0001');

    requestAndConfirmCancellation($this, $clientUser, $sales, $cof)
        ->assertOk()
        ->assertJsonPath('order_status', 'cancelled')
        ->assertJsonPath('dr_number', null);

    expect([batchQuantity('G-EARLY'), batchQuantity('G-LATE'), batchQuantity('M-1')])->toBe([4, 20, 10]);
    expect(cofTransactions($cof, 'cancel_return')->count())->toBe(3);
    expect(cofTransactions($cof, 'issue')->count())->toBe(3);
});

test('a confirmed cancellation broadcasts the restored stock level', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")->assertOk();
    Event::fake([StockLevelChanged::class]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/cancellation/confirm")->assertOk();

    Event::assertDispatched(StockLevelChanged::class, fn (StockLevelChanged $event) => $event->itemId === $item->id
        && $event->branchId === $sales->employee->branch_id
        && $event->available === 20);
});

test('confirming a cancellation twice returns the stock once', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    cofPick($this, $picker, $cof, $item, 3)->assertOk();
    requestAndConfirmCancellation($this, $clientUser, $sales, $cof)->assertOk();

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/cancellation/confirm")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cancellation_requested' => 'There is no cancellation request on this order.']);

    expect(batchQuantity('B-1'))->toBe(20);
    expect(cofTransactions($cof, 'cancel_return')->count())->toBe(1);
});

test('a cancellation can only be requested once the order is being processed', function () {
    $clientUser = makeClientUser();
    $pending = portalOrder($this, $clientUser, [Item::factory()->create()->id => 1]);

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$pending->id}/request-cancellation")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
});

test('accounting cannot confirm a cancellation request', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")->assertOk();
    grantRolePermission('cof.view', ['accounting']);

    $this->actingAs(assignStaffRole(makeStaffUser([], 'APALIT'), 'accounting'), 'staff')
        ->postJson("/api/staff/client-order-forms/{$cof->id}/cancellation/confirm")
        ->assertForbidden();
});
