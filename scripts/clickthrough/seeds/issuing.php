<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Client;
use App\Models\ClientItemPrice;
use App\Models\Item;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\AccountProvisioningService;
use App\Services\ClientOrderFormService;
use App\Services\ClientSubmissionService;
use App\Services\TransferService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;

$main = Branch::where('is_main', true)->firstOrFail();
$cebu = Branch::where('code', 'CEBU')->firstOrFail();
$sales = User::where('email', 'sales@mcvsync.test')->firstOrFail()->employee;
$accounting = User::where('email', 'accounting@mcvsync.test')->firstOrFail()->employee;
$purchasing = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;
$demoClient = Client::whereHas('user', fn ($query) => $query->where('email', 'client@mcvsync.test'))->firstOrFail();

$category = Category::create(['name' => 'Consumables']);
$boxes = Unit::create(['code' => 'box', 'name' => 'Box']);
$pieces = Unit::create(['code' => 'pcs', 'name' => 'Pieces']);
$item = fn (string $name, string $sku, string $barcode, Unit $unit, bool $expires) => Item::factory()->create([
    'name' => $name, 'sku' => $sku, 'barcode' => $barcode, 'category_id' => $category->id, 'unit_id' => $unit->id, 'has_expiry' => $expires,
]);
$gloves = $item('Surgical Gloves Medium', 'GLV-M-100', '4800001000011', $boxes, true);
$syringe = $item('Syringe 5ml', 'SYR-5ML', '4800001000028', $pieces, true);
$masks = $item('Face Mask Box', 'MSK-50', '4800001000035', $boxes, false);
$gauze = $item('Sterile Gauze Pad', 'GZE-4X4', '4800001000042', $boxes, true);

$stock = [
    [$gloves, $main, 'GLV-EARLY', 30, 60],
    [$gloves, $main, 'GLV-LATE', 50, 300],
    [$syringe, $main, 'SYR-B1', 100, 200],
    [$masks, $main, 'MSK-B1', 40, null],
    [$gauze, $main, 'GZE-B1', 20, 120],
    [$syringe, $cebu, 'SYR-CEBU', 50, 200],
];
foreach ($stock as [$stocked, $branch, $batch, $quantity, $expiresInDays]) {
    Batch::factory()->create([
        'item_id' => $stocked->id, 'branch_id' => $branch->id, 'batch_number' => $batch, 'quantity' => $quantity,
        'expiry_date' => $expiresInDays === null ? null : now()->addDays($expiresInDays)->toDateString(),
    ]);
}

$cebuClinic = app(AccountProvisioningService::class)->createClient(
    ['name' => 'Cebu Doctors Polyclinic', 'email' => 'cebupoly@mcvsync.test', 'password' => getenv('SEED_USER_PASSWORD')],
    ['address' => 'Lahug, Cebu City', 'contact' => '0917 555 0321', 'zone_id' => Zone::query()->value('id'), 'client_type' => 'direct', 'branch_id' => $cebu->id],
);

foreach ([$demoClient, $cebuClinic] as $client) {
    foreach ([[$gloves, 120], [$syringe, 10], [$masks, 80], [$gauze, 60]] as [$priced, $srp]) {
        ClientItemPrice::create(['client_id' => $client->id, 'item_id' => $priced->id, 'srp' => $srp, 'set_by' => $accounting->id]);
    }
}

$submissions = app(ClientSubmissionService::class);
$orders = app(ClientOrderFormService::class);
$travel = function (?CarbonImmutable $moment): void {
    Carbon::setTestNow($moment);
    CarbonImmutable::setTestNow($moment);
};
$submit = fn (Client $client, array $lines, ?string $notes) => $submissions->submit(
    $client,
    array_map(fn ($line) => ['item_id' => $line[0]->id, 'quantity' => $line[1]], $lines),
    $notes,
);

$travel(CarbonImmutable::now()->subDays(3));
$fullPick = $orders->forward($submit($demoClient, [[$gloves, 10], [$syringe, 20]], 'Click-through full pick'), $sales);
$travel(CarbonImmutable::now()->addDays(2));
$shortPick = $orders->forward($submit($demoClient, [[$masks, 10], [$gauze, 5]], 'Click-through short pick'), $sales);
$travel(null);
$offlinePick = $orders->forward($submit($demoClient, [[$syringe, 10], [$masks, 5]], 'Click-through offline pick'), $sales);
$cebuOrder = $orders->forward($submit($cebuClinic, [[$syringe, 5]], 'Click-through Cebu order'), $sales);
$pending = $submit($demoClient, [[$gauze, 2]], 'Click-through not forwarded');
$cancelRequested = $orders->forward($submit($demoClient, [[$gauze, 3]], 'Click-through cancel requested'), $sales);
$orders->requestCancellation($cancelRequested->fresh());

$transfer = app(TransferService::class)->create(['remarks' => 'Click-through transfer to pick'], [['item_id' => $masks->id, 'quantity' => 4]], $purchasing, $cebu->id);
app(TransferService::class)->approve($transfer, $purchasing, null);

foreach (['full pick' => $fullPick, 'short pick' => $shortPick, 'offline pick' => $offlinePick, 'cebu' => $cebuOrder, 'pending' => $pending, 'cancel requested' => $cancelRequested] as $label => $cof) {
    echo "{$label}: {$cof->cof_number} (#{$cof->id})\n";
}
echo "transfer to pick: {$transfer->transfer_number}\n";
