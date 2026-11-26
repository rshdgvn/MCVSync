<?php

use App\Models\ClientOrderForm;
use App\Models\Item;

function pickMatch($test, $picker, ClientOrderForm $cof, Item $item)
{
    return $test->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/match", ['item_id' => $item->id]);
}

function completePicking($test, $picker, ClientOrderForm $cof)
{
    return $test->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/complete");
}

function pickLine($test, $picker, ClientOrderForm $cof, Item $item, int $quantity)
{
    return $test->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => $quantity]);
}

test('forwarding stamps when the order entered processing and both screens show it', function () {
    $this->freezeSecond();
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');

    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);

    $this->actingAs($picker, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}/fulfill")
        ->assertOk()
        ->assertJsonPath('forwarded_at', now()->toIso8601String())
        ->assertJsonPath('picking_completed_at', null)
        ->assertJsonMissingPath('items.0.unit_cost');
    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")
        ->assertJsonPath('forwarded_at', now()->toIso8601String());
});

test('the pick queue lists the earliest delivery date first, undated orders last, then the oldest forward', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 100, '2027-06-30', 'B-1');
    $deliverBy = fn (ClientOrderForm $cof, ?string $date) => ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['request_delivery_date' => $date]);

    $undatedFirst = forwardedOrder($this, $sales, $clientUser, [$item->id => 1]);
    $this->travel(1)->hours();
    $later = forwardedOrder($this, $sales, $clientUser, [$item->id => 1]);
    $this->travel(1)->hours();
    $sooner = forwardedOrder($this, $sales, $clientUser, [$item->id => 1]);
    $this->travel(1)->hours();
    $undatedSecond = forwardedOrder($this, $sales, $clientUser, [$item->id => 1]);
    $deliverBy($later, now()->addDays(5)->toDateString());
    $deliverBy($sooner, now()->addDays(2)->toDateString());

    $ids = $this->actingAs($picker, 'staff')->getJson('/api/staff/client-order-forms/fulfillment-queue')->assertOk()->json('data.*.id');

    expect($ids)->toBe([$sooner->id, $later->id, $undatedFirst->id, $undatedSecond->id]);
});

test('completing a short pick stamps the order, takes it off the queue and closes it to more picking', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 5]);
    pickLine($this, $picker, $cof, $item, 3)->assertOk();

    completePicking($this, $picker, $cof)->assertOk()->assertJsonPath('order_status', 'processing');

    expect(ClientOrderForm::withoutGlobalScopes()->find($cof->id)->picking_completed_at)->not->toBeNull();
    $this->actingAs($picker, 'staff')->getJson('/api/staff/client-order-forms/fulfillment-queue')->assertJsonCount(0, 'data');
    $message = 'Picking is already complete for this order. Sales decides whether to dispatch what was picked.';
    pickLine($this, $picker, $cof, $item, 1)->assertUnprocessable()->assertJsonValidationErrors(['status' => $message]);
    pickMatch($this, $picker, $cof, $item)->assertUnprocessable()->assertJsonValidationErrors(['status' => $message]);
    completePicking($this, $picker, $cof)->assertUnprocessable()->assertJsonValidationErrors(['status' => $message]);
    expect(ClientOrderForm::withoutGlobalScopes()->find($cof->id)->items()->value('quantity_picked'))->toBe(3);
});

test('a fully picked order records when picking finished and leaves the queue', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 4]);

    pickLine($this, $picker, $cof, $item, 4)->assertOk()->assertJsonPath('order_status', 'ready_for_delivery');

    expect(ClientOrderForm::withoutGlobalScopes()->find($cof->id)->picking_completed_at)->not->toBeNull();
    $this->actingAs($picker, 'staff')->getJson('/api/staff/client-order-forms/fulfillment-queue')->assertJsonCount(0, 'data');
});

test('picking pauses while a cancellation is requested and resumes once it is declined', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);
    pickLine($this, $picker, $cof, $item, 2)->assertOk();
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/request-cancellation")->assertOk();

    $message = 'The client asked to cancel this order. Picking is paused until Sales or Purchasing confirms or declines the request.';
    pickLine($this, $picker, $cof, $item, 1)->assertUnprocessable()->assertJsonValidationErrors(['cancellation_requested' => $message]);
    pickMatch($this, $picker, $cof, $item)->assertUnprocessable()->assertJsonValidationErrors(['cancellation_requested' => $message]);
    completePicking($this, $picker, $cof)->assertUnprocessable()->assertJsonValidationErrors(['cancellation_requested' => $message]);
    expect(ClientOrderForm::withoutGlobalScopes()->find($cof->id)->items()->value('quantity_picked'))->toBe(2);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/cancellation/decline")->assertOk();

    pickMatch($this, $picker, $cof, $item)->assertOk()->assertJsonPath('remaining_quantity', 3);
    pickLine($this, $picker, $cof, $item, 3)->assertOk()->assertJsonPath('order_status', 'ready_for_delivery');
});
