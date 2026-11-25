<?php

use App\Models\ClientOrderForm;
use App\Models\Item;
use App\Models\Payment;
use App\Services\ClientSubmissionService;
use App\Services\DocumentService;
use App\Support\BusinessDate;
use App\Support\PaymentTerms;
use Carbon\CarbonImmutable;

function deliveredOrder($test, string $terms = '30 Days'): array
{
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create(['name' => 'Syringe 5ml']);
    stockAt($sales, $item, 20, '2027-06-30', 'SYR-1');
    $cof = forwardedOrder($test, $sales, $clientUser, [$item->id => 4], 25);
    $cof->update(['terms' => $terms]);
    $test->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 4])->assertOk();
    ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['order_status' => 'delivered']);

    return [$clientUser, $cof->fresh(), $sales, $picker];
}

test('a client submits an order and only ever sees its own orders', function () {
    $clientUser = makeClientUser();
    $other = makeClientUser();
    $item = Item::factory()->create();
    $mine = portalOrder($this, $clientUser, [$item->id => 2]);
    $theirs = portalOrder($this, $other, [$item->id => 9]);

    $this->actingAs($clientUser, 'client')->getJson('/api/portal/orders')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.order_number', $mine->cof_number);
    $this->actingAs($clientUser, 'client')->getJson("/api/portal/orders/{$theirs->id}")->assertNotFound();
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$theirs->id}/cancel")->assertNotFound();
});

test('the portal order shows client-facing fields only', function () {
    $clientUser = makeClientUser();
    $cof = portalOrder($this, $clientUser, [Item::factory()->create()->id => 2]);

    $this->actingAs($clientUser, 'client')->getJson("/api/portal/orders/{$cof->id}")
        ->assertOk()
        ->assertJsonPath('order_status', 'pending_approval')
        ->assertJsonPath('payment_status', null)
        ->assertJsonMissingPath('prepared_by')
        ->assertJsonMissingPath('branch')
        ->assertJsonMissingPath('dispatch_hold');
});

test('an order item must be active and listed once', function () {
    $clientUser = makeClientUser();
    $inactive = Item::factory()->create(['is_active' => false]);
    $item = Item::factory()->create();

    $this->actingAs($clientUser, 'client')->postJson('/api/portal/orders', ['items' => [['item_id' => $inactive->id, 'quantity' => 1]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items.0.item_id']);
    $this->actingAs($clientUser, 'client')->postJson('/api/portal/orders', ['items' => [['item_id' => $item->id, 'quantity' => 1], ['item_id' => $item->id, 'quantity' => 2]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items.1.item_id']);
});

test('the payment is due the terms after the delivery date', function () {
    expect(PaymentTerms::dueDate('30 Days', CarbonImmutable::parse('2026-11-01')))->toBe('2026-12-01');
    expect(PaymentTerms::dueDate('Net 15', CarbonImmutable::parse('2026-11-01 23:30:00')))->toBe('2026-11-16');
    expect(PaymentTerms::dueDate('COD', CarbonImmutable::parse('2026-11-01')))->toBe('2026-11-01');
});

test('without a recorded delivery date the payment is due the terms after the confirm date', function () {
    [$clientUser, $cof] = deliveredOrder($this, '30 Days');
    expect($cof->deliveryDate())->toBeNull();

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")->assertOk();

    expect(Payment::sole()->expected_payment_date->toDateString())->toBe(BusinessDate::today()->addDays(30)->toDateString());
});

test('confirming a delivered order completes it and creates the payment due after the terms', function () {
    [$clientUser, $cof] = deliveredOrder($this, '30 Days');

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")
        ->assertOk()
        ->assertJsonPath('order_status', 'completed')
        ->assertJsonPath('payment_status', 'payment_due');

    $payment = Payment::sole();
    expect($payment->reference_type)->toBe('client_order_form');
    expect((float) $payment->order_total)->toBe(100.0);
    expect($payment->payment_terms)->toBe('30 Days');
    expect($payment->expected_payment_date->toDateString())->toBe(BusinessDate::today()->addDays(30)->toDateString());

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")->assertUnprocessable();
    expect(Payment::count())->toBe(1);
});

test('cash on delivery or unrecognised terms are due immediately', function (?string $terms, string $label) {
    [$clientUser, $cof] = deliveredOrder($this, $terms ?? '');
    ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['terms' => $terms]);

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")->assertOk();

    expect(Payment::sole()->payment_terms)->toBe($label);
    expect(Payment::sole()->expected_payment_date->toDateString())->toBe(BusinessDate::todayString());
})->with([
    'COD' => ['COD', 'COD'],
    'no terms' => [null, 'COD'],
]);

test('only a delivered order can be confirmed or have an issue reported', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 2]);

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/confirm")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Only a delivered order can be confirmed as received.']);
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/report-issue", ['description' => 'Late'])
        ->assertUnprocessable();
});

test('a client reports an issue on a delivered order and sales sees it', function () {
    [$clientUser, $cof, $sales] = deliveredOrder($this);

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/report-issue")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['description']);
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/report-issue", ['description' => 'One box was crushed.'])
        ->assertOk()
        ->assertJsonPath('order_status', 'delivered')
        ->assertJsonPath('issue.description', 'One box was crushed.');

    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")
        ->assertJsonPath('issue.description', 'One box was crushed.');
    expect(Payment::count())->toBe(0);
});

test('a staff session cannot use the portal order endpoints', function () {
    $this->actingAs(makeSalesUser(), 'staff')->getJson('/api/portal/orders')->assertUnauthorized();
});

test('a client session cannot use the staff COF endpoints', function () {
    $clientUser = makeClientUser();
    $cof = app(ClientSubmissionService::class)->submit(clientOf($clientUser), [['item_id' => Item::factory()->create()->id, 'quantity' => 1]], null);

    $this->actingAs($clientUser, 'client')->getJson("/api/staff/client-order-forms/{$cof->id}")->assertUnauthorized();
});

test('the delivery receipt prints once the order is ready, with picked batches and signatures', function () {
    [$clientUser, $cof, $sales, $picker] = deliveredOrder($this);

    $response = $this->actingAs($picker, 'staff')->get("/api/staff/client-order-forms/{$cof->id}/delivery-receipt.pdf");
    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/pdf');
    expect($response->headers->get('Content-Disposition'))->toBe('inline; filename=DR-0001.pdf');
    expect(str_contains($response->getContent(), mb_convert_encoding('Delivery Receipt DR-0001', 'UTF-16BE', 'UTF-8')))->toBeTrue();

    $html = app(DocumentService::class)->deliveryReceiptView($cof)->render();
    expect($html)->toContain('DR-0001')
        ->toContain($cof->cof_number)
        ->toContain($clientUser->name)
        ->toContain('Syringe 5ml')
        ->toContain('SYR-1</span> × 4')
        ->toContain('₱100.00')
        ->toContain($sales->name)
        ->toContain('Checked by')
        ->toContain('Delivered by')
        ->toContain('Received by');

    $this->actingAs($sales, 'staff')->get("/api/staff/client-order-forms/{$cof->id}/delivery-receipt.pdf")->assertOk();
});

test('a delivery receipt is refused before the order is ready and hidden from other branches', function () {
    $sales = makeSalesUser();
    $cof = portalOrder($this, makeClientUser(), [Item::factory()->create()->id => 1]);

    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}/delivery-receipt.pdf")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
    $this->actingAs(makeSalesUser('CEBU'), 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}/delivery-receipt.pdf")->assertNotFound();
});
