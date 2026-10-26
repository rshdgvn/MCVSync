<?php

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Item;
use App\Models\StockReservation;
use App\Models\TransferRequest;

test('a purchasing user at a non-main branch can request stock from the main branch', function () {
    $main = makePurchasingUser('APALIT');
    $requester = makePurchasingUser('CEBU');
    $item = Item::factory()->create();

    $response = $this->actingAs($requester, 'staff')->postJson('/api/staff/transfers', [
        'remarks' => 'Running low',
        'items' => [['item_id' => $item->id, 'quantity' => 12]],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('transfer_number', 'TR-0001');
    $response->assertJsonPath('status', 'pending');
    $response->assertJsonPath('requesting_branch.id', $requester->employee->branch_id);
    $response->assertJsonPath('fulfilling_branch.id', $main->employee->branch_id);
    $response->assertJsonPath('items.0.quantity_requested', 12);
    $response->assertJsonPath('items.0.quantity_picked', 0);
});

test('transfer numbers increase across branches', function () {
    makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = makePurchasingUser('DAVAO');
    $item = Item::factory()->create();
    $payload = ['items' => [['item_id' => $item->id, 'quantity' => 1]]];

    $this->actingAs($cebu, 'staff')->postJson('/api/staff/transfers', $payload)->assertCreated();
    $this->actingAs($davao, 'staff')->postJson('/api/staff/transfers', $payload)->assertJsonPath('transfer_number', 'TR-0002');
});

test('the main branch cannot request a transfer from itself', function () {
    $main = makePurchasingUser('APALIT');
    $item = Item::factory()->create();

    $this->actingAs($main, 'staff')->postJson('/api/staff/transfers', [
        'items' => [['item_id' => $item->id, 'quantity' => 1]],
    ])->assertUnprocessable()->assertJsonValidationErrors('requesting_branch_id');
});

test('an admin must name the requesting branch', function () {
    makePurchasingUser('APALIT');
    $cebu = Branch::factory()->create(['code' => 'CEBU']);
    $admin = assignStaffRole(makeStaffUser([], 'APALIT'), 'admin');
    $item = Item::factory()->create();
    $items = [['item_id' => $item->id, 'quantity' => 1]];

    $this->actingAs($admin, 'staff')->postJson('/api/staff/transfers', ['items' => $items])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('requesting_branch_id');

    $this->actingAs($admin, 'staff')->postJson('/api/staff/transfers', ['requesting_branch_id' => $cebu->id, 'items' => $items])
        ->assertCreated()
        ->assertJsonPath('requesting_branch.id', $cebu->id);
});

test('a branch user cannot request on behalf of another branch', function () {
    makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = Branch::factory()->create(['code' => 'DAVAO']);
    $item = Item::factory()->create();

    $this->actingAs($cebu, 'staff')->postJson('/api/staff/transfers', [
        'requesting_branch_id' => $davao->id,
        'items' => [['item_id' => $item->id, 'quantity' => 1]],
    ])->assertCreated()->assertJsonPath('requesting_branch.id', $cebu->employee->branch_id);
});

test('a transfer cannot list the same item twice', function () {
    makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();

    $this->actingAs($cebu, 'staff')->postJson('/api/staff/transfers', [
        'items' => [['item_id' => $item->id, 'quantity' => 1], ['item_id' => $item->id, 'quantity' => 2]],
    ])->assertUnprocessable()->assertJsonValidationErrors('items.0.item_id');
});

test('purchasing sees transfers where its branch is either side, and nothing else', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $davao = makePurchasingUser('DAVAO');
    $item = Item::factory()->create();

    $cebuTransfer = makeTransfer($cebu, $main, [$item->id => 1]);
    $davaoTransfer = makeTransfer($davao, $main, [$item->id => 1]);

    $cebuIds = collect($this->actingAs($cebu, 'staff')->getJson('/api/staff/transfers')->json('data'))->pluck('id');
    expect($cebuIds->all())->toBe([$cebuTransfer->id]);

    $mainIds = collect($this->actingAs($main, 'staff')->getJson('/api/staff/transfers')->json('data'))->pluck('id');
    expect($mainIds->sort()->values()->all())->toBe([$cebuTransfer->id, $davaoTransfer->id]);

    $this->actingAs($cebu, 'staff')->getJson("/api/staff/transfers/{$davaoTransfer->id}")->assertNotFound();
});

test('transfers can be filtered by status', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();

    makeTransfer($cebu, $main, [$item->id => 1]);
    $cancelled = makeTransfer($cebu, $main, [$item->id => 1]);
    $cancelled->update(['status' => 'cancelled']);

    $ids = collect($this->actingAs($main, 'staff')->getJson('/api/staff/transfers?status=cancelled')->json('data'))->pluck('id');

    expect($ids->all())->toBe([$cancelled->id]);
});

test('roles without inventory access cannot use transfers', function () {
    makePurchasingUser('APALIT');

    foreach (['sales', 'accounting', 'logistics'] as $role) {
        $user = assignStaffRole(makeStaffUser([], 'CEBU'), $role);

        $this->actingAs($user, 'staff')->getJson('/api/staff/transfers')->assertForbidden();
    }
});

test('the requesting branch can cancel before picking and the reservation is released', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $main->employee->branch_id, 'quantity' => 10]);
    $transfer = makeTransfer($cebu, $main, [$item->id => 4]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $item->id])->assertOk();
    expect(StockReservation::withoutGlobalScopes()->where('reference_type', 'transfer_request')->where('status', 'active')->count())->toBe(1);

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/cancel")
        ->assertOk()
        ->assertJsonPath('status', 'cancelled');

    expect(StockReservation::withoutGlobalScopes()->where('reference_type', 'transfer_request')->where('status', 'active')->count())->toBe(0);
    expect(StockReservation::withoutGlobalScopes()->where('reference_type', 'transfer_request')->value('status'))->toBe('released');
});

test('the main branch cannot cancel a transfer', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = makeTransfer($cebu, $main, [Item::factory()->create()->id => 1]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/cancel")->assertForbidden();
    expect($transfer->fresh()->status)->toBe('pending');
});

test('a transfer cannot be cancelled once picking has started', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $main->employee->branch_id, 'quantity' => 10]);
    $transfer = makeTransfer($cebu, $main, [$item->id => 4]);

    $this->actingAs($main, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 1])->assertOk();

    $this->actingAs($cebu, 'staff')->postJson("/api/staff/transfers/{$transfer->id}/cancel")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect(TransferRequest::find($transfer->id)->status)->toBe('pending');
});
