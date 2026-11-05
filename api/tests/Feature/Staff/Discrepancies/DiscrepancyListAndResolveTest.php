<?php

use App\Models\Branch;
use App\Models\Discrepancy;
use App\Models\PurchaseOrder;
use App\Models\TransferRequest;

function discrepancyFor(PurchaseOrder|TransferRequest $document, array $attributes = []): Discrepancy
{
    return Discrepancy::factory()->create([
        'reference_type' => $document->getMorphClass(),
        'reference_id' => $document->getKey(),
        ...$attributes,
    ]);
}

function cebuBranch(): Branch
{
    return Branch::firstOrCreate(['code' => 'CEBU'], ['name' => 'Cebu', 'address' => 'Cebu', 'is_main' => false]);
}

test('a branch scoped user lists only discrepancies on documents that involve their branch', function () {
    $user = makePurchasingUser('APALIT');
    $ownBranch = $user->employee->branch_id;
    $cebu = cebuBranch();
    $davao = Branch::factory()->create();

    $ownPo = discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => $ownBranch, 'po_number' => 'PO-0042']));
    discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => $cebu->id]));
    $fulfilling = discrepancyFor(TransferRequest::factory()->create([
        'transfer_number' => 'TR-0007',
        'requesting_branch_id' => $cebu->id,
        'fulfilling_branch_id' => $ownBranch,
    ]));
    discrepancyFor(TransferRequest::factory()->create(['requesting_branch_id' => $cebu->id, 'fulfilling_branch_id' => $davao->id]));

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/discrepancies');

    $response->assertOk();
    $rows = collect($response->json('data'))->keyBy('id');
    expect($rows->keys()->sort()->values()->all())->toBe(collect([$ownPo->id, $fulfilling->id])->sort()->values()->all());
    expect($rows[$ownPo->id]['reference_number'])->toBe('PO-0042');
    expect($rows[$fulfilling->id]['reference_number'])->toBe('TR-0007');
    $response->assertJsonPath('counts.all', 2);
});

test('admin lists discrepancies across every branch', function () {
    $admin = assignStaffRole(makeStaffUser([], 'APALIT'), 'admin');
    discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => cebuBranch()->id]));
    discrepancyFor(PurchaseOrder::factory()->create());

    $this->actingAs($admin, 'staff')->getJson('/api/staff/discrepancies')
        ->assertOk()
        ->assertJsonPath('counts.all', 2);
});

test('discrepancies filter by resolution, type and document, with counts that ignore the resolution filter', function () {
    $user = makePurchasingUser('APALIT');
    $po = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id]);
    $otherPo = PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id]);

    $openShort = discrepancyFor($po, ['type' => 'short']);
    discrepancyFor($po, ['type' => 'short', 'resolved' => true]);
    discrepancyFor($po, ['type' => 'over']);
    discrepancyFor($otherPo, ['type' => 'short']);

    $response = $this->actingAs($user, 'staff')
        ->getJson("/api/staff/discrepancies?resolved=0&type=short&reference_type=purchase_order&reference_id={$po->id}");

    $response->assertOk();
    expect(collect($response->json('data'))->pluck('id')->all())->toBe([$openShort->id]);
    $response->assertJsonPath('counts', ['all' => 2, 'unresolved' => 1, 'resolved' => 1]);
});

test('invalid discrepancy filters are rejected', function () {
    $user = makePurchasingUser('APALIT');

    $this->actingAs($user, 'staff')
        ->getJson('/api/staff/discrepancies?type=missing&reference_type=invoice')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['type', 'reference_type']);
});

test('sales, accounting and logistics cannot list discrepancies', function () {
    foreach (['sales', 'accounting', 'logistics'] as $role) {
        $user = assignStaffRole(makeStaffUser([], 'APALIT'), $role);

        $this->actingAs($user, 'staff')->getJson('/api/staff/discrepancies')->assertForbidden();
    }
});

test('resolving a discrepancy records who resolved it and the optional note', function () {
    $user = makePurchasingUser('APALIT');
    $discrepancy = discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id]));

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", [
        'resolution_note' => 'Supplier sent the missing box on Nov 6.',
    ]);

    $response->assertOk();
    $response->assertJsonPath('resolved', true);
    $response->assertJsonPath('resolved_by', $user->name);
    $response->assertJsonPath('resolution_note', 'Supplier sent the missing box on Nov 6.');
    expect($discrepancy->fresh()->resolution_note)->toBe('Supplier sent the missing box on Nov 6.');
});

test('a discrepancy can be resolved without a note but only once', function () {
    $user = makePurchasingUser('APALIT');
    $discrepancy = discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id]));

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve")
        ->assertOk()
        ->assertJsonPath('resolution_note', null);

    $this->actingAs($user, 'staff')->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution_note' => 'Again'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['resolved' => 'This discrepancy has already been resolved.']);

    expect($discrepancy->fresh()->resolution_note)->toBeNull();
});

test('a resolution note longer than 1000 characters is rejected', function () {
    $user = makePurchasingUser('APALIT');
    $discrepancy = discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => $user->employee->branch_id]));

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve", ['resolution_note' => str_repeat('a', 1001)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('resolution_note');

    expect($discrepancy->fresh()->resolved)->toBeFalse();
});

test('a branch scoped user cannot resolve another branch discrepancy', function () {
    $user = makePurchasingUser('APALIT');
    $discrepancy = discrepancyFor(PurchaseOrder::factory()->create(['branch_id' => cebuBranch()->id]));

    $this->actingAs($user, 'staff')
        ->postJson("/api/staff/discrepancies/{$discrepancy->id}/resolve")
        ->assertNotFound();

    expect($discrepancy->fresh()->resolved)->toBeFalse();
});
