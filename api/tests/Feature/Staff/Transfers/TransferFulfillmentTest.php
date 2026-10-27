<?php

use App\Events\StockLevelChanged;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\FefoOverrideCode;
use App\Models\Item;
use App\Models\StockTransaction;
use App\Models\TransferRequest;
use Illuminate\Support\Facades\Event;

test('the first fulfill action reserves every line in full', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    stockAt($main, $gloves, 20, '2027-01-01', 'G-1');
    stockAt($main, $masks, 20, '2027-01-01', 'M-1');
    $transfer = makeTransfer($cebu, $main, [$gloves->id => 5, $masks->id => 8]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $gloves->id])
        ->assertOk()
        ->assertJsonPath('status', 'found')
        ->assertJsonPath('remaining_quantity', 5)
        ->assertJsonPath('suggested_batch.batch_number', 'G-1');

    expect(transferReservations($transfer)->where('status', 'active')->pluck('quantity', 'item_id')->all())
        ->toEqual([$gloves->id => 5, $masks->id => 8]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $masks->id])->assertOk();

    expect(transferReservations($transfer)->count())->toBe(2);
});

test('fulfillment cannot start when any line lacks stock, and nothing is reserved', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $gloves = Item::factory()->create();
    $masks = Item::factory()->create();
    stockAt($main, $gloves, 20, '2027-01-01', 'G-1');
    stockAt($main, $masks, 3, '2027-01-01', 'M-1');
    $transfer = makeTransfer($cebu, $main, [$gloves->id => 5, $masks->id => 8]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $gloves->id, 'quantity' => 5])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'insufficient_stock')
        ->assertJsonPath('item_id', $masks->id)
        ->assertJsonPath('available', 3);

    expect(transferReservations($transfer)->count())->toBe(0);
    expect(Batch::withoutGlobalScopes()->where('batch_number', 'G-1')->value('quantity'))->toBe(20);
});

test('picking without a batch takes the earliest expiring batch and consumes the reservation', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $later = stockAt($main, $item, 10, '2027-06-01', 'LATER');
    $sooner = stockAt($main, $item, 10, '2027-01-01', 'SOONER');
    $transfer = makeTransfer($cebu, $main, [$item->id => 6]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 4])
        ->assertOk()
        ->assertJsonPath('quantity_picked', 4);

    expect($sooner->fresh()->quantity)->toBe(6);
    expect($later->fresh()->quantity)->toBe(10);

    $transaction = StockTransaction::withoutGlobalScopes()->where('reference_type', 'transfer_request')->first();
    expect($transaction->type)->toBe('transfer_out');
    expect($transaction->quantity)->toBe(-4);
    expect($transaction->batch_id)->toBe($sooner->id);
    expect($transaction->performed_by)->toBe($main->employee->id);

    $reservation = transferReservations($transfer)->first();
    expect($reservation->quantity)->toBe(2);
    expect($reservation->status)->toBe('active');

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 2])->assertOk();

    expect($reservation->fresh()->quantity)->toBe(0);
    expect($reservation->fresh()->status)->toBe('fulfilled');
});

test('a pick larger than the batch is rejected with the batch quantity', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $first = stockAt($main, $item, 3, '2027-01-01', 'FIRST');
    stockAt($main, $item, 10, '2027-06-01', 'SECOND');
    $transfer = makeTransfer($cebu, $main, [$item->id => 5]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 5])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quantity');

    expect($first->fresh()->quantity)->toBe(3);
    expect(TransferRequest::withoutGlobalScopes()->find($transfer->id)->items()->value('quantity_picked'))->toBe(0);
});

test('picking more than is left on the line, or an item not on the transfer, is rejected', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $other = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'B-1');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 3])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quantity');

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $other->id, 'quantity' => 1])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('item_id');
});

test('only the main branch can pick', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'B-1');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])
        ->assertForbidden();
});

test('choosing a batch with the same expiry as the FEFO batch needs no override', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'A');
    $twin = stockAt($main, $item, 10, '2027-01-01', 'B');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id, 'quantity' => 2, 'batch_id' => $twin->id,
    ])->assertOk();

    expect($twin->fresh()->quantity)->toBe(8);
});

test('skipping an earlier expiring batch needs an override code and reason', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'SOONER');
    $later = stockAt($main, $item, 10, '2027-06-01', 'LATER');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id, 'quantity' => 2, 'batch_id' => $later->id,
    ])->assertUnprocessable()->assertJsonValidationErrors('override_code');

    expect($later->fresh()->quantity)->toBe(10);
});

test('a valid override code lets the picker take a later batch, is consumed, and is audited with its reason', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'SOONER');
    $later = stockAt($main, $item, 10, '2027-06-01', 'LATER');
    $transfer = makeTransfer($cebu, $main, [$item->id => 4]);
    $code = FefoOverrideCode::factory()->create(['code' => 'ABCD1234']);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id,
        'quantity' => 2,
        'batch_id' => $later->id,
        'override_code' => 'abcd1234',
        'override_reason' => 'Customer branch asked for the longer-dated stock.',
    ])->assertOk();

    expect($later->fresh()->quantity)->toBe(8);
    expect($code->fresh()->used)->toBeTrue();
    expect($code->fresh()->used_by)->toBe($main->employee->id);

    $audit = AuditLog::where('action', 'fefo.override_used')->first();
    expect($audit->metadata['reason'])->toBe('Customer branch asked for the longer-dated stock.');
    expect($audit->metadata['batch_id'])->toBe($later->id);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id,
        'quantity' => 2,
        'batch_id' => $later->id,
        'override_code' => 'ABCD1234',
        'override_reason' => 'Trying to reuse it.',
    ])->assertUnprocessable()->assertJsonValidationErrors('override_code');

    expect($later->fresh()->quantity)->toBe(8);
});

test('an expired override code is rejected', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'SOONER');
    $later = stockAt($main, $item, 10, '2027-06-01', 'LATER');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);
    FefoOverrideCode::factory()->create(['code' => 'EXPIRED1', 'expires_at' => now()->subMinute()]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id, 'quantity' => 2, 'batch_id' => $later->id,
        'override_code' => 'EXPIRED1', 'override_reason' => 'Late code.',
    ])->assertUnprocessable()->assertJsonValidationErrors('override_code');
});

test('a pick broadcasts the new stock level for the fulfilling branch', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'B-1');
    $transfer = makeTransfer($cebu, $main, [$item->id => 4]);

    Event::fake([StockLevelChanged::class]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 4])->assertOk();

    Event::assertDispatched(StockLevelChanged::class, fn (StockLevelChanged $event) => $event->itemId === $item->id
        && $event->branchId === $main->employee->branch_id
        && $event->current === 6
        && $event->reserved === 0
        && $event->available === 6);
});

test('a transfer ships only once every line is fully picked, and only the main branch ships it', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'B-1');
    $transfer = makeTransfer($cebu, $main, [$item->id => 4]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 3])->assertOk();
    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/ship")->assertUnprocessable();

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])->assertOk();
    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/ship")->assertForbidden();

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/ship")
        ->assertOk()
        ->assertJsonPath('status', 'shipped');

    expect(TransferRequest::withoutGlobalScopes()->find($transfer->id)->shipped_at)->not->toBeNull();

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});
