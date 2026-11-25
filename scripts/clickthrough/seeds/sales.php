<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Client;
use App\Models\ClientItemDiscount;
use App\Models\ClientItemPrice;
use App\Models\Item;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\AccountProvisioningService;
use App\Services\ClientOrderFormService;
use App\Services\ClientSubmissionService;
use App\Services\IncomingMessageService;
use Illuminate\Http\UploadedFile;

$main = Branch::where('is_main', true)->firstOrFail();
$sales = User::where('email', 'sales@mcvsync.test')->firstOrFail()->employee;
$accounting = User::where('email', 'accounting@mcvsync.test')->firstOrFail()->employee;
$picker = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;
$demoClient = Client::whereHas('user', fn ($query) => $query->where('email', 'client@mcvsync.test'))->firstOrFail();

$category = Category::create(['name' => 'Consumables']);
$boxes = Unit::create(['code' => 'box', 'name' => 'Box']);
$pieces = Unit::create(['code' => 'pcs', 'name' => 'Pieces']);
$item = fn (string $name, string $sku, Unit $unit) => Item::factory()->create([
    'name' => $name, 'sku' => $sku, 'category_id' => $category->id, 'unit_id' => $unit->id, 'has_expiry' => false,
]);
$gloves = $item('Surgical Gloves Medium', 'GLV-M-100', $boxes);
$masks = $item('Face Mask Box', 'MSK-50', $boxes);
$syringe = $item('Syringe 5ml', 'SYR-5ML', $pieces);
$shield = $item('Face Shield', 'FSH-01', $pieces);

foreach ([[$gloves, 50, 'GLV-B1'], [$masks, 3, 'MSK-B1'], [$syringe, 100, 'SYR-B1']] as [$stocked, $quantity, $batch]) {
    Batch::factory()->create(['item_id' => $stocked->id, 'branch_id' => $main->id, 'batch_number' => $batch, 'quantity' => $quantity, 'expiry_date' => null]);
}

foreach ([[$gloves, 120], [$masks, 80], [$syringe, 10]] as [$priced, $srp]) {
    ClientItemPrice::create(['client_id' => $demoClient->id, 'item_id' => $priced->id, 'srp' => $srp, 'set_by' => $accounting->id]);
}
ClientItemDiscount::create(['client_id' => $demoClient->id, 'item_id' => $gloves->id, 'discount_percent' => 5, 'set_by' => $sales->id]);

$clinic = app(AccountProvisioningService::class)->createClient(
    ['name' => 'Bayanihan Clinic', 'email' => 'orders@bayanihan.test', 'password' => getenv('SEED_USER_PASSWORD')],
    ['address' => 'Apalit, Pampanga', 'contact' => '0917 555 0199', 'zone_id' => Zone::where('name', 'Pampanga/Bulacan')->value('id'), 'client_type' => 'direct'],
);

$submissions = app(ClientSubmissionService::class);
$orders = [
    'review and forward' => [[$gloves, 10], [$syringe, 20]],
    'forward short' => [[$masks, 10]],
    'awaiting accounting' => [[$shield, 2]],
    'send back' => [[$syringe, 5]],
    'cancel after picking' => [[$syringe, 4]],
];
$cofs = [];
foreach ($orders as $label => $lines) {
    $cof = $submissions->submit($demoClient, array_map(fn ($line) => ['item_id' => $line[0]->id, 'quantity' => $line[1]], $lines), "Click-through {$label}");
    $cofs[$label] = $cof;
    echo "{$label}: {$cof->cof_number}\n";
}

$service = app(ClientOrderFormService::class);
$toCancel = $service->forward($cofs['cancel after picking'], $sales);
$service->pick($toCancel, ['item_id' => $syringe->id, 'quantity' => 4], $picker, $main->id);
$service->requestCancellation($toCancel->fresh());
echo "ready then cancellation requested: {$toCancel->fresh()->dr_number}\n";

$message = app(IncomingMessageService::class)->log(
    $clinic,
    'viber',
    UploadedFile::fake()->create('bayanihan-order.pdf', 24, 'application/pdf'),
    now()->subDays(2)->toDateTimeString(),
    'Photo of their handwritten order sheet.',
    $sales,
);
echo "aged message: {$message->id}\n";
