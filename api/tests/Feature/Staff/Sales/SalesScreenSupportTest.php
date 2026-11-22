<?php

use App\Models\ClientOrderForm;
use App\Models\Delivery;
use App\Models\IncomingClientMessage;
use App\Models\Item;
use App\Models\User;
use App\Support\BusinessDate;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('sales searches active items by name or SKU without seeing stock or costs', function () {
    $sales = makeSalesUser();
    Item::factory()->create(['name' => 'Surgical Gloves', 'sku' => 'GLV-100']);
    Item::factory()->create(['name' => 'Face Mask', 'sku' => 'MSK-GLV-2']);
    Item::factory()->create(['name' => 'Gloves Retired', 'sku' => 'OLD-1', 'is_active' => false]);

    $this->actingAs($sales, 'staff')->getJson('/api/staff/sales/items?search=GLV')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Face Mask')
        ->assertJsonPath('data.1.sku', 'GLV-100')
        ->assertJsonMissingPath('data.0.reorder_point')
        ->assertJsonMissingPath('data.0.available')
        ->assertJsonMissingPath('data.0.cogs');
});

test('only roles that create COFs can search the sales item list', function () {
    makeSalesUser();

    $this->actingAs(makePurchasingUser('APALIT'), 'staff')->getJson('/api/staff/sales/items')->assertForbidden();
});

test('the portal catalog still lists only active items', function () {
    $clientUser = makeClientUser();
    Item::factory()->create(['name' => 'Active Gauze']);
    Item::factory()->create(['name' => 'Retired Gauze', 'is_active' => false]);

    $this->actingAs($clientUser, 'client')->getJson('/api/portal/items?search=Gauze')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Active Gauze');
});

test('the COF list filters by source', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    $portal = portalOrder($this, $clientUser, [Item::factory()->create()->id => 1]);
    Storage::fake('local');
    $messageId = $this->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf($clientUser)->id, 'channel' => 'email',
        'attachment' => UploadedFile::fake()->create('po.pdf', 20, 'application/pdf'),
    ], ['Accept' => 'application/json'])->json('id');
    $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', [
        'client_id' => clientOf($clientUser)->id, 'incoming_message_id' => $messageId,
        'items' => [['item_id' => Item::factory()->create()->id, 'quantity' => 2]],
    ])->assertCreated();

    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-order-forms?source_type=portal')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $portal->id);
    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-order-forms?source_type=manual')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.source_type', 'manual');
    $this->actingAs($sales, 'staff')->getJson('/api/staff/client-order-forms?source_type=phone')->assertUnprocessable();
});

test('a logged message keeps its notes and links to the COF it became', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    Storage::fake('local');

    $messageId = $this->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf($clientUser)->id, 'channel' => 'messenger', 'notes' => 'Sent a photo of their order sheet.',
        'attachment' => UploadedFile::fake()->create('photo.pdf', 20, 'application/pdf'),
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('notes', 'Sent a photo of their order sheet.')
        ->assertJsonPath('converted_cof_id', null)
        ->json('id');

    $cofId = $this->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', [
        'client_id' => clientOf($clientUser)->id, 'incoming_message_id' => $messageId,
        'items' => [['item_id' => Item::factory()->create()->id, 'quantity' => 2]],
    ])->json('id');

    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cofId}")
        ->assertJsonPath('source', null)
        ->assertJsonPath('source_message.id', $messageId)
        ->assertJsonPath('source_message.channel', 'messenger')
        ->assertJsonPath('source_message.notes', 'Sent a photo of their order sheet.')
        ->assertJsonPath('source_message.logged_by', $sales->name);

    $this->actingAs($sales, 'staff')->getJson('/api/staff/incoming-messages')
        ->assertJsonPath('data.0.converted_cof_id', $cofId)
        ->assertJsonPath('data.0.status', 'converted');
    expect(IncomingClientMessage::withoutGlobalScopes()->find($messageId)->notes)->toBe('Sent a photo of their order sheet.');

    $this->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf($clientUser)->id, 'channel' => 'email', 'notes' => str_repeat('a', 2001),
        'attachment' => UploadedFile::fake()->create('po.pdf', 20, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['notes']);
});

test('the COF detail shows when it became ready and who received the delivery', function () {
    $sales = makeSalesUser();
    $picker = makePurchasingUser('APALIT');
    $item = Item::factory()->create();
    stockAt($sales, $item, 20, '2027-06-30', 'B-1');
    $cof = forwardedOrder($this, $sales, makeClientUser(), [$item->id => 2]);

    $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")
        ->assertJsonPath('ready_for_delivery_at', null)
        ->assertJsonPath('delivery', null);

    $this->actingAs($picker, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 2])->assertOk();
    Delivery::create([
        'client_order_form_id' => $cof->id, 'delivery_date' => BusinessDate::todayString(),
        'received_by' => 'Maria Santos', 'confirmed_by' => $picker->employee->id,
    ]);
    ClientOrderForm::withoutGlobalScopes()->whereKey($cof->id)->update(['order_status' => 'delivered']);

    $response = $this->actingAs($sales, 'staff')->getJson("/api/staff/client-order-forms/{$cof->id}")
        ->assertJsonPath('delivery.delivery_date', BusinessDate::todayString())
        ->assertJsonPath('delivery.received_by', 'Maria Santos');
    expect($response->json('ready_for_delivery_at'))->not->toBeNull();
});

function manualCofWithMessage($test, User $sales, User $clientUser): array
{
    Storage::fake('local');
    $messageId = $test->actingAs($sales, 'staff')->post('/api/staff/incoming-messages', [
        'client_id' => clientOf($clientUser)->id, 'channel' => 'viber', 'notes' => 'Internal note for Sales.',
        'attachment' => UploadedFile::fake()->create('order-sheet.pdf', 20, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated()->json('id');
    $cofId = $test->actingAs($sales, 'staff')->postJson('/api/staff/client-order-forms', [
        'client_id' => clientOf($clientUser)->id, 'incoming_message_id' => $messageId,
        'items' => [['item_id' => Item::factory()->create()->id, 'quantity' => 2]],
    ])->assertCreated()->json('id');

    return [$messageId, $cofId];
}

test('the portal never sees the logged message behind a manual COF', function () {
    $sales = makeSalesUser();
    $clientUser = makeClientUser();
    [, $cofId] = manualCofWithMessage($this, $sales, $clientUser);

    $response = $this->actingAs($clientUser, 'client')->getJson("/api/portal/orders/{$cofId}")->assertOk();

    $response->assertJsonMissingPath('source_message')->assertJsonMissingPath('data.source_message');
    expect($response->getContent())->not->toContain('Internal note for Sales.')->not->toContain('order-sheet.pdf');
});

test('anyone who can view COFs in the branch can download the message attachment, nobody else', function () {
    $sales = makeSalesUser();
    grantRolePermission('cof.view', ['accounting']);
    [$messageId] = manualCofWithMessage($this, $sales, makeClientUser());
    $url = "/api/staff/incoming-messages/{$messageId}/attachment";

    $this->actingAs(assignStaffRole(makeStaffUser(), 'accounting'), 'staff')->get($url)->assertOk()->assertDownload('order-sheet.pdf');
    $this->actingAs($sales, 'staff')->get($url)->assertOk();
    $this->actingAs(assignStaffRole(makeStaffUser(), 'accounting'), 'staff')->getJson('/api/staff/incoming-messages')->assertForbidden();
    $this->actingAs(makePurchasingUser('APALIT'), 'staff')->getJson($url)->assertForbidden();
    $this->actingAs(makeSalesUser('CEBU'), 'staff')->getJson($url)->assertNotFound();
    $this->actingAs(assignStaffRole(makeStaffUser([], 'CEBU'), 'accounting'), 'staff')->getJson($url)->assertNotFound();
});
