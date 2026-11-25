<?php

use App\Models\FefoOverrideCode;
use App\Models\Item;

test('the transfer list returns line counts and status counts that ignore the status filter', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $pending = makeTransfer($cebu, $main, [Item::factory()->create()->id => 2, Item::factory()->create()->id => 3]);
    makeTransfer($cebu, $main, [Item::factory()->create()->id => 1])->update(['status' => 'shipped']);
    makeTransfer($cebu, $main, [Item::factory()->create()->id => 1])->update(['status' => 'closed']);

    $response = $this->actingAs($main, 'staff')->getJson('/api/staff/transfers?status=pending');

    $response->assertOk();
    expect(collect($response->json('data'))->pluck('id')->all())->toBe([$pending->id]);
    $response->assertJsonPath('data.0.items_count', 2);
    $response->assertJsonPath('counts', ['all' => 3, 'awaiting_approval' => 0, 'pending' => 1, 'shipped' => 1, 'closed' => 1, 'cancelled' => 0, 'declined' => 0]);
});

test('the transfer list is searchable by transfer number and branch name', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = makePurchasingUser('DAVAO');
    $fromCebu = makeTransfer($cebu, $main, [Item::factory()->create()->id => 1]);
    $fromDavao = makeTransfer($davao, $main, [Item::factory()->create()->id => 1]);

    $byBranch = $this->actingAs($main, 'staff')->getJson('/api/staff/transfers?search=davao');
    expect(collect($byBranch->json('data'))->pluck('id')->all())->toBe([$fromDavao->id]);
    $byBranch->assertJsonPath('counts.all', 1);

    $byNumber = $this->actingAs($main, 'staff')->getJson("/api/staff/transfers?search={$fromCebu->transfer_number}");
    expect(collect($byNumber->json('data'))->pluck('id')->all())->toBe([$fromCebu->id]);
});

test('transfer counts for a requesting branch only include transfers involving that branch', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = makePurchasingUser('DAVAO');
    makeTransfer($cebu, $main, [Item::factory()->create()->id => 1]);
    makeTransfer($davao, $main, [Item::factory()->create()->id => 1]);

    $this->actingAs($cebu, 'staff')->getJson('/api/staff/transfers')
        ->assertOk()
        ->assertJsonPath('counts.all', 1);
});

function overridePick($test, $main, $transfer, $item, $batch, string $code)
{
    return $test->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", [
        'item_id' => $item->id,
        'quantity' => 2,
        'batch_id' => $batch->id,
        'override_code' => $code,
        'override_reason' => 'Customer asked for the later lot.',
    ]);
}

test('each unusable override code gets its own message', function (string $code, array $attributes, string $message) {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2027-01-01', 'SOONER');
    $later = stockAt($main, $item, 10, '2027-06-01', 'LATER');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);
    if ($attributes !== []) {
        FefoOverrideCode::factory()->create(['code' => $code, ...$attributes]);
    }

    overridePick($this, $main, $transfer, $item, $later, $code)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['override_code' => $message]);

    expect($transfer->items()->first()->quantity_picked)->toBe(0);
})->with([
    'unknown' => ['NOPE1234', [], 'This override code does not exist. Check the 8 characters and try again.'],
    'used' => ['USEDCODE', ['used' => true, 'expires_at' => now()->addMinutes(10)], 'This override code was already used. Ask the Super Admin for a new one.'],
    'expired' => ['OLDCODE1', ['expires_at' => now()->subMinute()], 'This override code has expired. Ask the Super Admin for a new one.'],
]);
