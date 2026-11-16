<?php

use App\Models\Item;
use App\Models\Payment;
use App\Models\Supplier;
use App\Services\PaymentService;
use App\Support\BusinessDate;
use Illuminate\Support\Carbon;

const MANILA_HALF_PAST_MIDNIGHT = '2026-11-16 16:30:00';

beforeEach(function () {
    config(['mcvsync.business_timezone' => 'Asia/Manila']);
    Carbon::setTestNow(Carbon::parse(MANILA_HALF_PAST_MIDNIGHT, 'UTC'));
});

afterEach(function () {
    Carbon::setTestNow();
});

test('business today follows Manila, not the UTC storage clock', function () {
    expect(now()->toDateString())->toBe('2026-11-16');
    expect(BusinessDate::todayString())->toBe('2026-11-17');
    expect(BusinessDate::daysFromToday('2026-11-16'))->toBe(-1);
    expect(BusinessDate::daysFromToday('2026-11-20'))->toBe(3);
});

test('a payment received today in Manila can be approved just after midnight', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash',
        'date_received' => '2026-11-17',
    ])->assertOk();
});

test('a payment dated the day after Manila today is still in the future', function () {
    $user = assignStaffRole(makeStaffUser(), 'accounting');
    $payment = Payment::factory()->create(['status' => 'payment_due']);

    $this->actingAs($user, 'staff')->postJson("/api/staff/payments/{$payment->id}/approve", [
        'method' => 'cash',
        'date_received' => '2026-11-18',
    ])->assertUnprocessable()->assertJsonValidationErrors('date_received');
});

test('days overdue count from the Manila date', function () {
    $payments = app(PaymentService::class);

    $dueYesterday = Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => '2026-11-16']);
    $dueToday = Payment::factory()->create(['status' => 'payment_due', 'expected_payment_date' => '2026-11-17']);

    expect($payments->daysOverdue($dueYesterday))->toBe(1);
    expect($payments->daysOverdue($dueToday))->toBe(0);
});

test('the near-expiry alert window counts days from the Manila date', function () {
    $user = makePurchasingUser('APALIT');
    $item = Item::factory()->create(['expiry_alert_threshold_days' => 5]);
    $inside = stockAt($user, $item, 5, '2026-11-22', 'INSIDE');
    $outside = stockAt($user, $item, 5, '2026-11-23', 'OUTSIDE');

    $ids = collect($this->actingAs($user, 'staff')->getJson('/api/staff/inventory/alerts/expiring')->json('data'))->pluck('id');

    expect($ids)->toContain($inside->id)->not->toContain($outside->id);
});

test('fefo skips a batch that expired yesterday in Manila', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    stockAt($main, $item, 10, '2026-11-16', 'EXPIRED');
    stockAt($main, $item, 10, '2026-11-17', 'TODAY');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($main, 'staff')
        ->postJson("/api/staff/transfers/{$transfer->id}/fulfill/match", ['item_id' => $item->id])
        ->assertOk()
        ->assertJsonPath('suggested_batch.batch_number', 'TODAY');
});

test('an expired batch cannot be picked even when chosen directly', function () {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $item = Item::factory()->create();
    $expired = stockAt($main, $item, 10, '2026-11-16', 'EXPIRED');
    stockAt($main, $item, 10, '2026-11-30', 'GOOD');
    $transfer = makeTransfer($cebu, $main, [$item->id => 2]);

    $this->actingAs($main, 'staff')
        ->postJson("/api/staff/transfers/{$transfer->id}/fulfill/pick", ['item_id' => $item->id, 'quantity' => 2, 'batch_id' => $expired->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['batch_id' => 'This batch is not available for this item at the fulfilling branch.']);
});

test('a new purchase order is dated with the Manila date', function () {
    $user = makePurchasingUser('APALIT');

    $this->actingAs($user, 'staff')->postJson('/api/staff/purchase-orders', [
        'supplier_id' => Supplier::factory()->create()->id,
        'branch_id' => $user->employee->branch_id,
        'items' => [['item_id' => Item::factory()->create()->id, 'quantity_ordered' => 1, 'unit_cost' => 10]],
    ])->assertCreated()->assertJsonPath('order_date', '2026-11-17');
});

test('the business timezone is configurable', function () {
    config(['mcvsync.business_timezone' => 'UTC']);

    expect(BusinessDate::todayString())->toBe('2026-11-16');
});
