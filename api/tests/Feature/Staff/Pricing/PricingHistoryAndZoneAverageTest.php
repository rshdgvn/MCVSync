<?php

use App\Models\Item;

test('price history returns every row for a client and item, newest first', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $client = makeClientUser()->client;
    $item = Item::factory()->create();

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 100,
    ])->assertCreated();

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 110,
    ])->assertCreated();

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $client->id, 'item_id' => $item->id, 'srp' => 125,
    ])->assertCreated();

    $response = $this->actingAs($user, 'staff')
        ->getJson("/api/staff/pricing/client-item-prices/history?client_id={$client->id}&item_id={$item->id}");

    $response->assertOk();
    $srps = collect($response->json('data'))->pluck('srp');
    expect($srps->all())->toBe([125, 110, 100]);
});

test('history requires both client_id and item_id', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $this->actingAs($user, 'staff')
        ->getJson('/api/staff/pricing/client-item-prices/history')
        ->assertUnprocessable();
});

test('zone average uses each clients current price only, not every historical price', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $item = Item::factory()->create();

    $clientA = makeClientUser([], 'North Zone')->client;
    $clientB = makeClientUser([], 'North Zone')->client;
    $zoneId = $clientA->zone_id;

    // Client A: an old price of 200, renegotiated down to 100 — only 100 should count.
    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $clientA->id, 'item_id' => $item->id, 'srp' => 200,
    ])->assertCreated();
    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $clientA->id, 'item_id' => $item->id, 'srp' => 100,
    ])->assertCreated();

    // Client B: single price of 140.
    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $clientB->id, 'item_id' => $item->id, 'srp' => 140,
    ])->assertCreated();

    $response = $this->actingAs($user, 'staff')
        ->getJson("/api/staff/pricing/client-item-prices/zone-average?item_id={$item->id}&zone_id={$zoneId}");

    $response->assertOk();
    // (100 + 140) / 2 = 120, not (200 + 100 + 140) / 3.
    $response->assertJsonPath('average', 120);
});

test('zone average excludes clients outside the given zone', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $item = Item::factory()->create();

    $inZone = makeClientUser([], 'South Zone')->client;
    $outOfZone = makeClientUser([], 'East Zone')->client;

    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $inZone->id, 'item_id' => $item->id, 'srp' => 80,
    ])->assertCreated();
    $this->actingAs($user, 'staff')->postJson('/api/staff/pricing/client-item-prices', [
        'client_id' => $outOfZone->id, 'item_id' => $item->id, 'srp' => 500,
    ])->assertCreated();

    $response = $this->actingAs($user, 'staff')
        ->getJson("/api/staff/pricing/client-item-prices/zone-average?item_id={$item->id}&zone_id={$inZone->zone_id}");

    $response->assertJsonPath('average', 80);
});

test('zone average is null when no client in the zone has priced the item', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $item = Item::factory()->create();
    $client = makeClientUser([], 'Empty Zone')->client;

    $response = $this->actingAs($user, 'staff')
        ->getJson("/api/staff/pricing/client-item-prices/zone-average?item_id={$item->id}&zone_id={$client->zone_id}");

    $response->assertOk();
    $response->assertJsonPath('average', null);
});
