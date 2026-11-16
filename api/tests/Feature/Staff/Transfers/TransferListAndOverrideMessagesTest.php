<?php

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
    $response->assertJsonPath('counts', ['all' => 3, 'pending' => 1, 'shipped' => 1, 'closed' => 1, 'cancelled' => 0]);
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
