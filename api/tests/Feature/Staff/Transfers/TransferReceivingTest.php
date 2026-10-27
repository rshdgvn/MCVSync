<?php

use App\Models\Batch;
use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\StockTransaction;
use App\Models\TransferRequest;
use App\Models\TransferRequestItem;
use Illuminate\Support\Facades\DB;

function markShipped(TransferRequest $transfer): TransferRequestItem
{
    $transfer->items()->update(['quantity_picked' => DB::raw('quantity_requested')]);
    $transfer->update(['status' => 'shipped', 'shipped_at' => now()]);

    return $transfer->items()->first();
}

function receivePayload(TransferRequestItem $line, int $quantity): array
{
    return [
        'transfer_request_item_id' => $line->id,
        'quantity_received' => $quantity,
        'batch_number' => 'TR-BATCH-1',
        'expiry_date' => '2027-03-01',
    ];
}

test('the requesting branch receives a shipped transfer into its own stock', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $transfer = makeTransfer($cebu, $main, [$item->id => 5]);
    $line = markShipped($transfer);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/match", ['item_id' => $item->id])
        ->assertOk()
        ->assertJsonPath('status', 'found')
        ->assertJsonPath('remaining_quantity', 5);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 5))
        ->assertOk()
        ->assertJsonPath('quantity_received', 5);

    $batch = Batch::withoutGlobalScopes()->where('batch_number', 'TR-BATCH-1')->first();
    expect($batch->branch_id)->toBe($cebu->employee->branch_id);
    expect($batch->quantity)->toBe(5);

    $transaction = StockTransaction::withoutGlobalScopes()->where('type', 'transfer_in')->first();
    expect($transaction->quantity)->toBe(5);
    expect($transaction->reference_type)->toBe('transfer_request');
    expect($transaction->branch_id)->toBe($cebu->employee->branch_id);
});

test('the main branch cannot receive its own shipment', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $line = markShipped($transfer);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 5))
        ->assertForbidden();
});

test('a transfer cannot be received before it ships', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $line = $transfer->items()->first();

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 5))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

test('completing a fully matched receipt closes the transfer', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $line = markShipped($transfer);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 5))->assertOk();

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/complete")
        ->assertOk()
        ->assertJsonPath('status', 'closed');

    expect(TransferRequest::withoutGlobalScopes()->find($transfer->id)->received_at)->not->toBeNull();
});

test('a short receipt keeps the transfer shipped with a short discrepancy', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $line = markShipped($transfer);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 3))->assertOk();

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/complete")
        ->assertOk()
        ->assertJsonPath('status', 'shipped');

    $discrepancy = Discrepancy::whereMorphedTo('referenceItem', $line)->first();
    expect($discrepancy->type)->toBe('short');
    expect($discrepancy->reference_type)->toBe('transfer_request');
    expect($discrepancy->reference_id)->toBe($transfer->id);
    expect($discrepancy->scanned_quantity)->toBe(3);
});

test('receiving more than was shipped logs an over discrepancy immediately', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    $line = markShipped($transfer);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/confirm", receivePayload($line, 7))->assertOk();

    expect(Discrepancy::whereMorphedTo('referenceItem', $line)->where('type', 'over')->value('scanned_quantity'))->toBe(7);
});

test('an item not on the transfer can be logged, listed, and resolved by either branch on it', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = makePurchasingUser('DAVAO');
    $stranger = Item::factory()->create();
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 5]);
    markShipped($transfer);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/match", ['item_id' => $stranger->id])
        ->assertOk()
        ->assertJsonPath('status', 'not_found');

    $discrepancyId = $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/receive/discrepancy", [
        'type' => 'not_found',
        'item_id' => $stranger->id,
        'scanned_quantity' => 2,
    ])->assertCreated()->assertJsonPath('reference_type', 'transfer_request')->json('id');

    $this->actingAs($main, 'staff')->getJson("/api/staff/transfers/{$transfer->id}/discrepancies")
        ->assertOk()
        ->assertJsonCount(1);

    $this->actingAs($davao, 'staff')->postJson("/api/staff/discrepancies/{$discrepancyId}/resolve")->assertNotFound();

    $this->actingAs($main, 'staff')->postJson("/api/staff/discrepancies/{$discrepancyId}/resolve")
        ->assertOk()
        ->assertJsonPath('resolved', true)
        ->assertJsonPath('resolved_by', $main->name);
});
