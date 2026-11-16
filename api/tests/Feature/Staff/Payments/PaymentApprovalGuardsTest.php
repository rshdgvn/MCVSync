<?php

use App\Models\Payment;

test('a payment cannot be approved with a future date received', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash',
        'date_received' => now()->addDay()->toDateString(),
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date_received' => "The date received can't be in the future."]);

    expect($payment->fresh()->status)->toBe('payment_due');
});

test('a payment received today can be approved', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'check',
        'date_received' => now()->toDateString(),
        'reference_note' => 'CHK-0042',
    ])->assertOk()->assertJsonPath('reference_note', 'CHK-0042');
});

test('a second approval of the same payment keeps the first approval', function () {
    $first = assignStaffRole(makeStaffUser(), 'accounting');
    $second = assignStaffRole(makeStaffUser(), 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($first, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'bank_transfer',
        'date_received' => now()->toDateString(),
        'reference_note' => 'FIRST',
    ])->assertOk();

    $this->actingAs($second, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash',
        'date_received' => now()->toDateString(),
        'reference_note' => 'SECOND',
    ])->assertUnprocessable()->assertJsonValidationErrors(['status' => 'This payment has already been approved.']);

    $fresh = $payment->fresh();
    expect($fresh->reference_note)->toBe('FIRST');
    expect($fresh->approved_by)->toBe($first->employee->id);
});
