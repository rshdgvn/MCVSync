<?php

use App\Models\Batch;
use App\Models\ClientOrderForm;
use App\Models\Discrepancy;
use App\Models\IncomingClientMessage;
use App\Models\Item;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\StockTransaction;
use App\Models\TransferRequest;
use App\Models\User;
use App\Support\BusinessDate;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Support\Facades\Storage;

function seedDemo($test): void
{
    $test->seed(DatabaseSeeder::class);
    $test->seed(DemoDataSeeder::class);
}

beforeEach(function () {
    Storage::fake('local');
    config(['services.seed_user_password' => 'staging-password', 'services.demo_data' => true]);
});

test('the demo seeder walks every order, stock and payment state through the services', function () {
    seedDemo($this);

    expect(ClientOrderForm::query()->distinct()->orderBy('order_status')->pluck('order_status')->all())->toBe([
        'cancelled', 'completed', 'delivered', 'needs_revision', 'pending_approval', 'processing', 'ready_for_delivery',
    ]);
    expect(ClientOrderForm::query()->where('cancellation_requested', true)->count())->toBe(1);
    expect(ClientOrderForm::query()->where('order_status', 'processing')->count())->toBe(2);
    expect(ClientOrderForm::query()->whereNotNull('issue_reported_at')->count())->toBe(1);
    expect(Discrepancy::query()->where('reference_type', 'client_order_form')->where('resolved', false)->count())->toBe(1);
    expect(TransferRequest::query()->distinct()->orderBy('status')->pluck('status')->all())->toBe([
        'awaiting_approval', 'cancelled', 'closed', 'declined', 'pending', 'shipped',
    ]);
    expect(PurchaseOrder::query()->distinct()->orderBy('status')->pluck('status')->all())->toBe([
        'cancelled', 'closed', 'draft', 'open', 'ready_for_delivery',
    ]);
    expect(Discrepancy::query()->where('reference_type', 'purchase_order')->exists())->toBeTrue();
    expect(Payment::query()->where('status', 'paid')->count())->toBeGreaterThan(3);
    expect(Payment::query()->where('status', 'payment_due')->where('expected_payment_date', '<', BusinessDate::todayString())->exists())->toBeTrue();
    expect(IncomingClientMessage::query()->where('status', 'received')->count())->toBe(4);
    expect(IncomingClientMessage::query()->where('status', 'converted')->count())->toBe(2);
    expect(Batch::query()->where('quantity', '>', 0)->where('expiry_date', '<=', BusinessDate::today()->addDays(30)->toDateString())->exists())->toBeTrue();
    expect(User::query()->where('email', 'sales.cebu@mcvsync.test')->firstOrFail()->hasRole('sales'))->toBeTrue();
});

test('every seeded batch quantity matches its stock transactions', function () {
    seedDemo($this);

    $ledger = StockTransaction::query()->selectRaw('batch_id, sum(quantity) as total')->groupBy('batch_id')->pluck('total', 'batch_id');

    Batch::query()->get()->each(fn (Batch $batch) => expect((int) $ledger[$batch->id])->toBe((int) $batch->quantity));
});

test('the demo seeder runs once and only when switched on', function () {
    config(['services.demo_data' => false]);
    $this->seed(DatabaseSeeder::class);
    expect(Item::query()->count())->toBe(0);

    config(['services.demo_data' => true]);
    $this->seed(DemoDataSeeder::class);
    $items = Item::query()->count();
    $this->seed(DemoDataSeeder::class);

    expect($items)->toBeGreaterThan(30);
    expect(Item::query()->count())->toBe($items);
    expect(ClientOrderForm::query()->count())->toBe(ClientOrderForm::query()->distinct()->count('cof_number'));
});

test('the demo reset refuses to wipe the database unless DEMO_DATA is on', function () {
    config(['services.demo_data' => false]);
    $this->seed(DatabaseSeeder::class);
    $users = User::query()->count();

    $this->artisan('app:reset-demo')
        ->expectsOutputToContain('Refusing to reset: DEMO_DATA is not true.')
        ->assertFailed();

    expect(User::query()->count())->toBe($users);
});
