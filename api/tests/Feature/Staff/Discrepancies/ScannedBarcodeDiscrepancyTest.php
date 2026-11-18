<?php

use App\Models\Branch;
use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\TransferRequest;

const UNKNOWN_BARCODE = '4899999999999';

function openPurchaseOrderFor($user): PurchaseOrder
{
    return PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
}

beforeEach(fn () => grantRolePermission('discrepancy.resolve'));

test('a not_found discrepancy can be logged with only the scanned barcode', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'not_found',
        'scanned_barcode' => UNKNOWN_BARCODE,
        'scanned_quantity' => 2,
    ])
        ->assertCreated()
        ->assertJsonPath('scanned_barcode', UNKNOWN_BARCODE)
        ->assertJsonPath('item', null);

    expect(Discrepancy::where('scanned_barcode', UNKNOWN_BARCODE)->whereNull('item_id')->count())->toBe(1);
});

test('a not_found discrepancy with neither an item nor a barcode is rejected', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'not_found',
        'scanned_barcode' => '',
    ])->assertUnprocessable()->assertJsonValidationErrors(['item_id' => 'A not_found discrepancy needs either the item or the scanned barcode.']);

    expect(Discrepancy::count())->toBe(0);
});

test('a scanned barcode longer than 255 characters is rejected', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);

    $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/discrepancy", [
        'type' => 'not_found',
        'scanned_barcode' => str_repeat('9', 256),
    ])->assertUnprocessable()->assertJsonValidationErrors('scanned_barcode');
});

test('a transfer receipt can log a barcode-only not_found discrepancy', function () {
    $receiver = makePurchasingUser('CEBU');
    $transfer = TransferRequest::factory()->create([
        'requesting_branch_id' => $receiver->employee->branch_id,
        'fulfilling_branch_id' => Branch::where('is_main', true)->value('id') ?? makePurchasingUser('APALIT')->employee->branch_id,
        'status' => 'shipped',
    ]);

    $this->actingAs($receiver, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/discrepancy", [
        'type' => 'not_found',
        'scanned_barcode' => UNKNOWN_BARCODE,
    ])->assertCreated()->assertJsonPath('scanned_barcode', UNKNOWN_BARCODE);
});

test('the discrepancy list shows the scanned barcode', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);
    Discrepancy::factory()->create(['reference_id' => $po->id, 'type' => 'not_found', 'item_id' => null, 'scanned_barcode' => UNKNOWN_BARCODE]);

    $this->actingAs($user, 'staff')->getJson('/api/staff/discrepancies')
        ->assertOk()
        ->assertJsonPath('data.0.scanned_barcode', UNKNOWN_BARCODE);
});

test('resolving a barcode-only discrepancy can link it to an item', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);
    $item = Item::factory()->create();
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id, 'type' => 'not_found', 'item_id' => null, 'scanned_barcode' => UNKNOWN_BARCODE]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution' => 'accepted', 'item_id' => $item->id])
        ->assertOk()
        ->assertJsonPath('resolved', true)
        ->assertJsonPath('item.id', $item->id)
        ->assertJsonPath('scanned_barcode', UNKNOWN_BARCODE);
});

test('a discrepancy already linked to an item cannot be relinked', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);
    $original = Item::factory()->create();
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id, 'item_id' => $original->id]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution' => 'accepted', 'item_id' => Item::factory()->create()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['item_id' => 'This discrepancy is already linked to an item.']);

    $fresh = $discrepancy->fresh();
    expect($fresh->item_id)->toBe($original->id);
    expect($fresh->resolved)->toBeFalse();
});

test('linking a discrepancy to an item that does not exist is rejected', function () {
    $user = makePurchasingUser('APALIT');
    $po = openPurchaseOrderFor($user);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id, 'item_id' => null, 'scanned_barcode' => UNKNOWN_BARCODE]);

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution' => 'accepted', 'item_id' => 999999])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('item_id');
});

test('another branch cannot resolve and link a barcode-only discrepancy', function () {
    $owner = makePurchasingUser('APALIT');
    $outsider = makePurchasingUser('CEBU');
    $po = openPurchaseOrderFor($owner);
    $discrepancy = Discrepancy::factory()->create(['reference_id' => $po->id, 'item_id' => null, 'scanned_barcode' => UNKNOWN_BARCODE]);

    $this->actingAs($outsider, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution' => 'accepted', 'item_id' => Item::factory()->create()->id])
        ->assertNotFound();

    expect($discrepancy->fresh()->item_id)->toBeNull();
});
