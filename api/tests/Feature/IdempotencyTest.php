<?php

use App\Models\Batch;
use App\Models\Discrepancy;
use App\Models\IdempotencyKey;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

function receivablePurchaseOrder(User $user, int $ordered = 10): array
{
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id, 'status' => 'open']);
    $item = Item::factory()->create(['has_expiry' => false]);
    $line = $po->items()->create([
        'item_id' => $item->id, 'quantity_ordered' => $ordered, 'quantity_received' => 0,
        'unit_cost' => 10, 'discount' => 0, 'total' => $ordered * 10,
    ]);

    return [$po, $line];
}

function confirmWithKey($test, User $user, PurchaseOrder $po, int $lineId, string $key, int $quantity = 4)
{
    return $test->actingAs($user, 'staff')->postJson(
        "/api/staff/purchase-orders/{$po->id}/receive/confirm",
        ['purchase_order_item_id' => $lineId, 'quantity_received' => $quantity, 'batch_number' => 'IDEM-1'],
        ['Idempotency-Key' => $key],
    );
}

test('a receipt sent twice with the same key is applied once and replays the original response', function () {
    $user = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($user);
    $key = (string) Str::uuid();

    $first = confirmWithKey($this, $user, $po, $line->id, $key)->assertOk();
    $second = confirmWithKey($this, $user, $po, $line->id, $key)->assertOk();

    expect($second->json())->toBe($first->json());
    $second->assertHeader('Idempotent-Replayed', 'true');
    expect($line->fresh()->quantity_received)->toBe(4);
    expect(StockTransaction::where('item_id', $line->item_id)->count())->toBe(1);
    expect(Batch::where('item_id', $line->item_id)->sum('quantity'))->toBe(4);
    expect(IdempotencyKey::count())->toBe(1);
});

test('a pick sent twice with the same key is applied once', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $batch = stockAt($main, $item, 10, '2027-12-31', 'IDEM-PICK');
    $transfer = makeTransfer($cebu, $main, [$item->id => 6]);
    $key = (string) Str::uuid();

    foreach ([1, 2] as $attempt) {
        $this->actingAs($main, 'staff')
            ->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 2], ['Idempotency-Key' => $key])
            ->assertOk()
            ->assertJsonPath('quantity_picked', 2);
    }

    expect($batch->fresh()->quantity)->toBe(8);
    expect($transfer->items()->first()->quantity_picked)->toBe(2);
});

test('a discrepancy log sent twice with the same key creates one discrepancy', function () {
    $user = makePurchasingUser('APALIT');
    [$po] = receivablePurchaseOrder($user);
    $key = (string) Str::uuid();

    foreach ([1, 2] as $attempt) {
        $this->actingAs($user, 'staff')->postJson(
            "/api/staff/purchase-orders/{$po->id}/receive/discrepancy",
            ['type' => 'not_found', 'scanned_barcode' => '4899999999999'],
            ['Idempotency-Key' => $key],
        )->assertCreated();
    }

    expect(Discrepancy::count())->toBe(1);
});

test('reusing a key for a different request is a conflict and changes nothing', function () {
    $user = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($user);
    $key = (string) Str::uuid();

    confirmWithKey($this, $user, $po, $line->id, $key, 4)->assertOk();
    confirmWithKey($this, $user, $po, $line->id, $key, 5)
        ->assertConflict()
        ->assertJsonPath('message', 'This Idempotency-Key was already used for a different request.');

    expect($line->fresh()->quantity_received)->toBe(4);
});

test('the same key from two different users is applied for each user', function () {
    $first = makePurchasingUser('APALIT');
    $second = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($first);
    $key = (string) Str::uuid();

    confirmWithKey($this, $first, $po, $line->id, $key)->assertOk();
    confirmWithKey($this, $second, $po, $line->id, $key)->assertOk()->assertHeaderMissing('Idempotent-Replayed');

    expect($line->fresh()->quantity_received)->toBe(8);
});

test('a rejected request stores no key, so a corrected retry with the same key still applies', function () {
    $user = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($user);
    $key = (string) Str::uuid();

    $this->actingAs($user, 'staff')->postJson(
        "/api/staff/purchase-orders/{$po->id}/receive/confirm",
        ['purchase_order_item_id' => $line->id, 'quantity_received' => 4],
        ['Idempotency-Key' => $key],
    )->assertUnprocessable();

    expect(IdempotencyKey::count())->toBe(0);
    confirmWithKey($this, $user, $po, $line->id, $key)->assertOk();
    expect($line->fresh()->quantity_received)->toBe(4);
});

test('a user without access gets no key stored and nothing applied', function () {
    $owner = makePurchasingUser('APALIT');
    $outsider = makePurchasingUser('CEBU');
    [$po, $line] = receivablePurchaseOrder($owner);

    confirmWithKey($this, $outsider, $po, $line->id, (string) Str::uuid())->assertNotFound();

    expect(IdempotencyKey::count())->toBe(0);
    expect($line->fresh()->quantity_received)->toBe(0);
});

test('a key that is not a UUID is rejected before anything is applied', function () {
    $user = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($user);

    confirmWithKey($this, $user, $po, $line->id, 'not-a-uuid')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('idempotency_key');

    expect($line->fresh()->quantity_received)->toBe(0);
});

test('requests without a key keep working as before', function () {
    $user = makePurchasingUser('APALIT');
    [$po, $line] = receivablePurchaseOrder($user);

    foreach ([1, 2] as $attempt) {
        $this->actingAs($user, 'staff')->postJson("/api/staff/purchase-orders/{$po->id}/receive/confirm", [
            'purchase_order_item_id' => $line->id, 'quantity_received' => 3, 'batch_number' => 'NO-KEY',
        ])->assertOk();
    }

    expect($line->fresh()->quantity_received)->toBe(6);
    expect(IdempotencyKey::count())->toBe(0);
});

test('keys older than seven days are pruned and newer ones are kept', function () {
    $user = makePurchasingUser('APALIT');
    $row = fn (int $daysAgo) => IdempotencyKey::forceCreate([
        'key' => (string) Str::uuid(),
        'user_id' => $user->id,
        'fingerprint' => str_repeat('a', 64),
        'response_status' => 200,
        'response_body' => '{}',
        'created_at' => now()->subDays($daysAgo),
        'updated_at' => now()->subDays($daysAgo),
    ]);
    $old = $row(8);
    $recent = $row(6);

    Artisan::call('model:prune', ['--model' => [IdempotencyKey::class]]);

    expect(IdempotencyKey::find($old->id))->toBeNull();
    expect(IdempotencyKey::find($recent->id))->not->toBeNull();
});

test('pruning idempotency keys is scheduled daily', function () {
    Artisan::call('schedule:list');

    expect(Artisan::output())->toContain('model:prune')->toContain('IdempotencyKey');
});
