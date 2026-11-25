<?php

use App\Models\Payment;
use App\Support\BusinessDate;

test('accounting can approve a pending payment', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $payment = Payment::factory()->create([
        'status' => 'payment_due',
        'order_total' => 1000,
        'payment_terms' => 'COD',
    ]);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'bank_transfer',
        'date_received' => now()->toDateString(),
        'reference_note' => 'TXN-12345',
    ]);

    $response->assertOk();
    $response->assertJsonPath('status', 'paid');
    $response->assertJsonPath('method', 'bank_transfer');
    $response->assertJsonPath('approved_by', $user->name);
    expect($payment->fresh()->approved_at)->not->toBeNull();
});

test('approving an already approved payment is rejected', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $payment = Payment::factory()->create(['status' => 'paid']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash',
        'date_received' => now()->toDateString(),
    ])->assertUnprocessable();
});

test('approving a payment requires a valid method and date_received', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $response = $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'bitcoin',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['method', 'date_received']);
});

test('pending list only shows payment_due rows with days overdue computed', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $overdue = Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => BusinessDate::today()->subDays(5)->toDateString()]);
    $notYetDue = Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => BusinessDate::today()->addDays(3)->toDateString()]);
    $paid = Payment::factory()->create(['status' => 'paid']);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/payments/pending');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($overdue->id, $notYetDue->id)->not->toContain($paid->id);

    $overdueRow = collect($response->json('data'))->firstWhere('id', $overdue->id);
    $notYetDueRow = collect($response->json('data'))->firstWhere('id', $notYetDue->id);

    expect($overdueRow['days_overdue'])->toBe(5);
    expect($notYetDueRow['days_overdue'])->toBe(0);
});

test('history list only shows paid rows', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');

    $paid = Payment::factory()->create(['status' => 'paid']);
    $due = Payment::factory()->create(['status' => 'payment_due']);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/payments/history');

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($paid->id)->not->toContain($due->id);
});

test('admin can read payments but cannot approve one', function () {
    $admin = makeStaffUser();
    assignStaffRole($admin, 'admin');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($admin, 'staff')->getJson('/api/staff/payments/pending')->assertOk();

    $this->actingAs($admin, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash', 'date_received' => now()->toDateString(),
    ])->assertForbidden();
});

test('sales and purchasing have no access to payments at all', function () {
    foreach (['sales', 'purchasing'] as $role) {
        $user = makeStaffUser();
        assignStaffRole($user, $role);

        $this->actingAs($user, 'staff')->getJson('/api/staff/payments/pending')->assertForbidden();
    }
});

test('pending summary counts every pending payment, not just the current page', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');

    Payment::factory()->count(2)->create(['status' => 'payment_due', 'expected_payment_date' => BusinessDate::today()->subDay()->toDateString()]);
    Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => BusinessDate::todayString()]);
    Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => BusinessDate::today()->addDays(10)->toDateString()]);
    Payment::factory()->create(['status' => 'paid', 'expected_payment_date' => BusinessDate::today()->subDays(30)->toDateString()]);

    $this->actingAs($user, 'staff')->getJson('/api/staff/payments/pending?per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('summary.total', 4)
        ->assertJsonPath('summary.overdue', 2)
        ->assertJsonPath('summary.within_terms', 2);
});

test('pending summary is all zeros when nothing is pending', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');

    $this->actingAs($user, 'staff')->getJson('/api/staff/payments/pending')
        ->assertOk()
        ->assertJsonPath('summary', ['total' => 0, 'overdue' => 0, 'within_terms' => 0]);
});
