<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Category;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\AccountProvisioningService;
use App\Services\PricingService;
use App\Services\PurchaseOrderService;

$purchasing = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;
$accounting = User::where('email', 'accounting@mcvsync.test')->firstOrFail()->employee;
$pampanga = Zone::where('name', 'Pampanga/Bulacan')->firstOrFail();
$southLuzon = Zone::where('name', 'South Luzon')->firstOrFail();

$provisioning = app(AccountProvisioningService::class);
$clients = [];
foreach ([['Alpha Hospital', $pampanga], ['Beta Clinic', $pampanga], ['Gamma Pharmacy', $pampanga], ['Delta Medical', $southLuzon]] as [$name, $zone]) {
    $email = strtolower(str_replace(' ', '.', $name)).'@clickthrough.test';
    $clients[$name] = $provisioning->createClient(
        ['name' => $name, 'email' => $email, 'password' => getenv('SEED_USER_PASSWORD')],
        ['zone_id' => $zone->id, 'address' => 'Click-through address', 'contact' => '0917 000 0000', 'client_type' => 'direct'],
    );
}

$category = Category::create(['name' => 'Consumables']);
$boxes = Unit::create(['code' => 'box', 'name' => 'Box']);
$pieces = Unit::create(['code' => 'pcs', 'name' => 'Pieces']);
$gloves = Item::factory()->create(['name' => 'Surgical Gloves Medium', 'sku' => 'GLV-M-100', 'category_id' => $category->id, 'unit_id' => $boxes->id]);
$syringe = Item::factory()->create(['name' => 'Syringe 5ml', 'sku' => 'SYR-5ML', 'category_id' => $category->id, 'unit_id' => $pieces->id]);
Item::factory()->create(['name' => 'Face Shield', 'sku' => 'FSH-01', 'category_id' => $category->id, 'unit_id' => $pieces->id]);

$supplier = Supplier::create(['name' => 'Luzon Surgical Corp']);
$orders = app(PurchaseOrderService::class);
$orders->create(['supplier_id' => $supplier->id, 'branch_id' => $purchasing->branch_id, 'order_date' => now()->subDays(20)->toDateString()], [['item_id' => $gloves->id, 'quantity_ordered' => 10, 'unit_cost' => 450]], $purchasing);
$orders->create(['supplier_id' => $supplier->id, 'branch_id' => $purchasing->branch_id], [['item_id' => $gloves->id, 'quantity_ordered' => 10, 'unit_cost' => 470], ['item_id' => $syringe->id, 'quantity_ordered' => 100, 'unit_cost' => 6.5]], $purchasing);

$pricing = app(PricingService::class);
$pricing->setPrice($clients['Alpha Hospital']->id, $gloves->id, 520, $accounting);
$pricing->setPrice($clients['Beta Clinic']->id, $gloves->id, 540, $accounting);
$pricing->setPrice($clients['Alpha Hospital']->id, $syringe->id, 9, $accounting);

echo "accounting fixtures ready\n";
