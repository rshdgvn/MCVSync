<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\EmployeeRoleAssignmentService;
use App\Services\FulfillmentService;
use App\Services\PurchaseOrderService;
use App\Services\TransferService;

$main = Branch::where('is_main', true)->firstOrFail();
$cebu = Branch::where('code', 'CEBU')->firstOrFail();
$mainEmployee = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;

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
$gauze = Item::factory()->create([
    'name' => 'Gauze Pad 4x4', 'sku' => 'GZE-44', 'barcode' => '4800001000059',
    'category_id' => $category->id, 'unit_id' => $pieces->id, 'has_expiry' => false,
]);

Batch::factory()->create(['item_id' => $gloves->id, 'branch_id' => $main->id, 'batch_number' => 'GLV-MAIN', 'quantity' => 40, 'expiry_date' => '2027-06-30']);
Batch::factory()->create(['item_id' => $syringe->id, 'branch_id' => $main->id, 'batch_number' => 'SYR-MAIN', 'quantity' => 60, 'expiry_date' => null]);

$provisioning = app(AccountProvisioningService::class);
$roles = app(EmployeeRoleAssignmentService::class);
$people = [];
$staff = [
    ['name' => 'Second Picker', 'email' => 'purchasing.two@mcvsync.test', 'branch' => $main->id],
    ['name' => 'Cebu Purchasing', 'email' => 'cebu.purchasing@mcvsync.test', 'branch' => $cebu->id],
];
foreach ($staff as $person) {
    $employee = $provisioning->createStaff(
        ['name' => $person['name'], 'email' => $person['email'], 'password' => getenv('SEED_USER_PASSWORD')],
        branchId: $person['branch'],
        position: 'Purchasing Officer',
    );
    $roles->assign($employee, 'purchasing');
    $people[$person['email']] = $employee;
}
$cebuEmployee = $people['cebu.purchasing@mcvsync.test'];

$purchaseOrders = app(PurchaseOrderService::class);
$orders = [
    'offline receiving' => [
        ['item_id' => $gloves->id, 'quantity_ordered' => 10, 'unit_cost' => 450],
        ['item_id' => $syringe->id, 'quantity_ordered' => 5, 'unit_cost' => 6.5],
        ['item_id' => $gauze->id, 'quantity_ordered' => 4, 'unit_cost' => 3],
    ],
    'live receiving' => [
        ['item_id' => $gloves->id, 'quantity_ordered' => 6, 'unit_cost' => 450],
        ['item_id' => $syringe->id, 'quantity_ordered' => 5, 'unit_cost' => 6.5],
    ],
];
foreach ($orders as $label => $lines) {
    $order = $purchaseOrders->create(['supplier_id' => $supplier->id, 'branch_id' => $main->id, 'remarks' => "Click-through {$label}"], $lines, $mainEmployee);
    $order->update(['status' => 'ready_for_delivery']);
    echo "{$label}: {$order->po_number}\n";
}

$transfers = app(TransferService::class);
$pickRequest = $transfers->create(
    ['remarks' => 'Click-through offline pick'],
    [['item_id' => $gloves->id, 'quantity' => 8], ['item_id' => $syringe->id, 'quantity' => 10]],
    $cebuEmployee,
    $cebu->id,
);
echo "offline pick: {$pickRequest->transfer_number}\n";

$shipment = $transfers->create(['remarks' => 'Click-through offline receive'], [['item_id' => $gloves->id, 'quantity' => 3]], $cebuEmployee, $cebu->id);
app(FulfillmentService::class)->pick($shipment, ['item_id' => $gloves->id, 'quantity' => 3], $mainEmployee, $main->id);
$transfers->ship($shipment->fresh(), $main->id);
echo "offline receive: {$shipment->transfer_number}\n";
