<?php

use App\Models\ClientItemDiscount;
use App\Models\ClientOrderForm;
use App\Models\ClientSubmission;
use App\Models\IncomingClientMessage;
use App\Models\Item;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function loggedMessage($test, $sales, $clientUser): IncomingClientMessage
{
    Storage::fake('local');

    $id = $test->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf($clientUser)->id,
        'channel' => 'viber',
        'attachment' => UploadedFile::fake()->create('order.pdf', 50, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated()->json('id');

    return IncomingClientMessage::withoutGlobalScopes()->findOrFail($id);
}

test('a portal order creates a pending COF copied from the submission at the client branch', function () {
    $clientUser = makeClientUser([], 'Pampanga/Bulacan', 'CEBU');
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    ClientItemDiscount::create(['client_id' => clientOf($clientUser)->id, 'item_id' => $gloves->id, 'discount_percent' => 5, 'set_by' => makeSalesUser()->employee->id]);

    $cof = portalOrder($this, $clientUser, [$gloves->id => 10, $masks->id => 4], 'Deliver before noon.');

    expect($cof->order_status)->toBe('pending_approval');
    expect($cof->source_type)->toBe('portal');
    expect($cof->cof_number)->toBe('COF-0001');
    expect($cof->branch_id)->toBe(testBranch('CEBU')->id);
    expect($cof->prepared_by)->toBeNull();
    expect($cof->remarks)->toBe('Deliver before noon.');
    expect($cof->items()->pluck('quantity', 'item_id')->all())->toBe([$gloves->id => 10, $masks->id => 4]);
    expect((float) $cof->items()->where('item_id', $gloves->id)->value('discount_percent'))->toBe(5.0);
    expect(ClientSubmission::find($cof->source_id)->converted_cof_id)->toBe($cof->id);
});

test('sales reviews a portal COF beside the original submission with suggested prices', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    priceFor($clientUser, $gloves, 120, $sales);
    $cof = portalOrder($this, $clientUser, [$gloves->id => 10, $masks->id => 4]);

    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")
        ->assertOk()
        ->assertJsonPath('source.items.0.quantity', 10)
        ->assertJsonPath('items.0.suggested_unit_cost', 120)
        ->assertJsonPath('items.1.suggested_unit_cost', null)
        ->assertJsonPath('needs_pricing_item_ids', [$masks->id]);
});

test('a manual COF needs a logged message with its attachment, used only once and for the same client', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    $message = loggedMessage($this, $sales, $clientUser);
    $payload = fn (int $clientId) => [
        'client_id' => $clientId, 'incoming_message_id' => $message->id, 'terms' => '30 Days',
        'items' => [['item_id' => $item->id, 'quantity' => 6]],
    ];

    $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', $payload(clientOf(makeClientUser())->id))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['incoming_message_id' => 'This message came from a different client.']);

    $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', $payload(clientOf($clientUser)->id))
        ->assertCreated()
        ->assertJsonPath('source_type', 'manual')
        ->assertJsonPath('prepared_by', $sales->name)
        ->assertJsonPath('terms', '30 Days');

    expect($message->fresh()->status)->toBe('converted');

    $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', $payload(clientOf($clientUser)->id))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['incoming_message_id']);
});

test('logging a message requires an attachment of an allowed type', function () {
    $sales = makeSalesUser();
    Storage::fake('local');

    $this->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf(makeClientUser())->id,
        'channel' => 'email',
        'attachment' => UploadedFile::fake()->create('order.exe', 10),
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['attachment']);
});

test('changing a portal line quantity needs a reason and is flagged as differing from the request', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    $cof = portalOrder($this, $clientUser, [$item->id => 10]);

    $this->actingAs($sales, 'staff')->patchJson("/api/staff/client-order-forms/{$cof->id}", ['items' => [['item_id' => $item->id, 'quantity' => 8]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items.0.differs_from_request_reason']);

    $this->actingAs($sales, 'staff')->patchJson("/api/staff/client-order-forms/{$cof->id}", [
        'terms' => '15 Days',
        'items' => [['item_id' => $item->id, 'quantity' => 8, 'discount_percent' => 10, 'differs_from_request_reason' => 'Only 8 boxes left this week.']],
    ])
        ->assertOk()
        ->assertJsonPath('terms', '15 Days')
        ->assertJsonPath('items.0.differs_from_request', true)
        ->assertJsonPath('items.0.discount_percent', 10);
});

test('a COF can only be edited while pending approval', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, $clientUser, [$item->id => 5]);

    $this->actingAs($sales, 'staff')->patchJson("/api/staff/client-order-forms/{$cof->id}", ['remarks' => 'Too late'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Only an order pending approval can be edited.']);
});

test('sales sends a portal order back for revision and the client resubmits it', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    $other = Item::factory()->create();
    $cof = portalOrder($this, $clientUser, [$item->id => 10]);

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/send-for-revision", ['revision_reason' => 'Please confirm the size.'])
        ->assertOk()
        ->assertJsonPath('order_status', 'needs_revision');

    $this->actingAs($clientUser, 'client')->getJson("/api/portal/orders/{$cof->id}")
        ->assertJsonPath('revision_reason', 'Please confirm the size.');

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$cof->id}/resubmit", ['items' => [['item_id' => $other->id, 'quantity' => 3]], 'notes' => 'Large size'])
        ->assertOk()
        ->assertJsonPath('order_status', 'pending_approval')
        ->assertJsonPath('revision_reason', null);

    expect($cof->items()->pluck('quantity', 'item_id')->all())->toBe([$other->id => 3]);
    expect(ClientSubmission::find($cof->source_id)->items()->pluck('quantity', 'item_id')->all())->toBe([$other->id => 3]);
});

test('a manual order cannot be sent back to the client and only revisable orders can be resubmitted', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    $message = loggedMessage($this, $sales, $clientUser);
    $id = $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', [
        'client_id' => clientOf($clientUser)->id, 'incoming_message_id' => $message->id, 'items' => [['item_id' => $item->id, 'quantity' => 2]],
    ])->json('id');

    $this->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$id}/send-for-revision", ['revision_reason' => 'Check'])
        ->assertUnprocessable();
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$id}/resubmit", ['items' => [['item_id' => $item->id, 'quantity' => 3]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
});

test('the client cancels instantly only before the order is forwarded', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $pending = portalOrder($this, $clientUser, [$item->id => 2]);
    $forwarded = forwardedOrder($this, $sales, $clientUser, [$item->id => 3]);

    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$pending->id}/cancel")->assertOk()->assertJsonPath('order_status', 'cancelled');
    $this->actingAs($clientUser, 'client')->postJson("/api/portal/orders/{$forwarded->id}/cancel")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
});

test('sales of another branch cannot see or edit the COF', function () {
    makeSalesUser();
    $cebuSales = makeSalesUser('CEBU');
    $cof = portalOrder($this, makeClientUser(), [Item::factory()->create()->id => 2]);

    $this->actingAs($cebuSales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")->assertNotFound();
    $this->actingAs($cebuSales, 'staff')->patchJson("/api/staff/client-order-forms/{$cof->id}", ['remarks' => 'x'])->assertNotFound();
    $this->actingAs($cebuSales, 'staff')->getJson('/api/staff/client-order-forms')->assertJsonPath('counts.all', 0);
});

test('accounting reads COFs but cannot edit them, and purchasing cannot open the Sales COF screens', function () {
    makeSalesUser();
    grantRolePermission('cof.view', ['accounting']);
    $accounting = assignStaffRole(makeStaffUser([], 'APALIT'), 'accounting');
    $cof = portalOrder($this, makeClientUser(), [Item::factory()->create()->id => 2]);

    $this->actingAs($accounting, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")->assertOk();
    $this->actingAs($accounting, 'staff')->patchJson("/api/staff/client-order-forms/{$cof->id}", ['remarks' => 'x'])->assertForbidden();
    $this->actingAs(makePurchasingUser('APALIT'), 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")->assertForbidden();
});

test('cof numbers increase across portal and manual orders', function () {
    $clientUser = makeClientUser();
    $first = portalOrder($this, $clientUser, [Item::factory()->create()->id => 1]);
    $second = portalOrder($this, $clientUser, [Item::factory()->create()->id => 1]);

    expect([$first->cof_number, $second->cof_number])->toBe(['COF-0001', 'COF-0002']);
    expect(ClientOrderForm::withoutGlobalScopes()->count())->toBe(2);
});
