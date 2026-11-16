<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Batch;
use App\Models\Category;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Services\PurchaseOrderService;

$employee = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;
$home = $employee->branch;

$supplier = Supplier::create(['name' => 'Luzon Surgical Corp', 'phone' => '02 8123 4567']);
$category = Category::create(['name' => 'Consumables']);
$pieces = Unit::create(['code' => 'pcs', 'name' => 'Pieces']);
$boxes = Unit::create(['code' => 'box', 'name' => 'Box']);

$gloves = Item::factory()->create([
    'name' => 'Surgical Gloves Medium', 'sku' => 'GLV-M-100', 'barcode' => '4800001000011',
    'category_id' => $category->id, 'unit_id' => $boxes->id, 'has_expiry' => true,
]);
$syringe = Item::factory()->create([
    'name' => 'Syringe 5ml', 'sku' => 'SYR-5ML', 'barcode' => '4800001000028',
    'category_id' => $category->id, 'unit_id' => $pieces->id, 'has_expiry' => false,
]);
Item::factory()->create([
    'name' => 'Face Shield', 'sku' => 'FSH-01', 'barcode' => '4800001000042',
    'category_id' => $category->id, 'unit_id' => $pieces->id,
]);

Batch::factory()->create([
    'item_id' => $gloves->id,
    'branch_id' => $home->id,
    'batch_number' => 'LOT-A',
    'quantity' => 3,
    'expiry_date' => '2027-06-30',
]);

$service = app(PurchaseOrderService::class);
$orders = [
    'mobile mixed' => [['item_id' => $gloves->id, 'quantity_ordered' => 10, 'unit_cost' => 450], ['item_id' => $syringe->id, 'quantity_ordered' => 5, 'unit_cost' => 6.5]],
    'mobile full' => [['item_id' => $gloves->id, 'quantity_ordered' => 6, 'unit_cost' => 450]],
    'desktop mixed' => [['item_id' => $gloves->id, 'quantity_ordered' => 10, 'unit_cost' => 450], ['item_id' => $syringe->id, 'quantity_ordered' => 5, 'unit_cost' => 6.5]],
    'desktop full' => [['item_id' => $gloves->id, 'quantity_ordered' => 6, 'unit_cost' => 450]],
];

foreach ($orders as $label => $lines) {
    $po = $service->create(['supplier_id' => $supplier->id, 'branch_id' => $home->id, 'remarks' => "Click-through {$label}"], $lines, $employee);
    $po->update(['status' => 'ready_for_delivery']);
    echo "{$label}: {$po->po_number}\n";
}
