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
use App\Services\DiscrepancyService;
use App\Services\EmployeeRoleAssignmentService;
use App\Services\ReceivingService;
use App\Services\PurchaseOrderService;
use App\Services\TransferService;

$cebu = Branch::where('code', 'CEBU')->firstOrFail();
$main = Branch::where('is_main', true)->firstOrFail();

$acme = Supplier::create(['name' => 'Acme Medical Supplies', 'contact_person' => 'Jane Dela Cruz', 'phone' => '0917 123 4567']);
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
$alcohol = Item::factory()->create([
    'name' => 'Isopropyl Alcohol 500ml', 'sku' => 'ALC-500', 'barcode' => '4800001000035',
    'category_id' => $category->id, 'unit_id' => $pieces->id, 'has_expiry' => true,
]);
$faceShield = Item::factory()->create([
    'name' => 'Face Shield', 'sku' => 'FSH-01', 'barcode' => '4800001000042',
    'category_id' => $category->id, 'unit_id' => $pieces->id,
    'reorder_point' => 5, 'reorder_quantity' => 25, 'preferred_supplier_id' => $acme->id,
]);

Batch::factory()->create(['item_id' => $gloves->id, 'branch_id' => $main->id, 'batch_number' => 'GLV-EARLY', 'quantity' => 6, 'expiry_date' => '2027-01-31']);
Batch::factory()->create(['item_id' => $gloves->id, 'branch_id' => $main->id, 'batch_number' => 'GLV-LATE', 'quantity' => 20, 'expiry_date' => '2027-09-30']);
Batch::factory()->create(['item_id' => $syringe->id, 'branch_id' => $main->id, 'batch_number' => 'SYR-MAIN', 'quantity' => 50, 'expiry_date' => null]);
Batch::factory()->create(['item_id' => $alcohol->id, 'branch_id' => $main->id, 'batch_number' => 'ALC-MAIN', 'quantity' => 2, 'expiry_date' => '2027-03-31']);

$cebuEmployee = app(AccountProvisioningService::class)->createStaff([
    'name' => 'Cebu Purchasing',
    'email' => 'cebu.purchasing@mcvsync.test',
    'password' => getenv('SEED_USER_PASSWORD'),
], branchId: $cebu->id, position: 'Purchasing Officer');
app(EmployeeRoleAssignmentService::class)->assign($cebuEmployee, 'purchasing');

$service = app(TransferService::class);
$requests = [
    'mobile pick' => [['item_id' => $gloves->id, 'quantity' => 8], ['item_id' => $syringe->id, 'quantity' => 10]],
    'desktop pick' => [['item_id' => $gloves->id, 'quantity' => 4], ['item_id' => $syringe->id, 'quantity' => 5]],
    'shortage' => [['item_id' => $alcohol->id, 'quantity' => 10]],
];

$approver = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;

foreach ($requests as $label => $items) {
    $transfer = $service->create(['remarks' => "Click-through {$label}"], $items, $cebuEmployee, $cebu->id);
    $service->approve($transfer, $approver, $main->id);
    echo "{$label}: {$transfer->transfer_number}\n";
}

$purchaseOrders = app(PurchaseOrderService::class);
$earlier = $purchaseOrders->create(
    ['supplier_id' => $acme->id, 'branch_id' => $main->id, 'order_date' => '2026-10-01', 'remarks' => 'Click-through earlier face shields'],
    [['item_id' => $faceShield->id, 'quantity_ordered' => 10, 'unit_cost' => 30]],
    $approver,
);
$earlier->update(['status' => 'closed']);
$lowStockDraft = $purchaseOrders->draftForLowStock($faceShield->id, $main->id);
echo "low stock draft: {$lowStockDraft->po_number}\n";

foreach (['to approve', 'to decline'] as $label) {
    $transfer = $service->create(['remarks' => "Click-through {$label}"], [['item_id' => $syringe->id, 'quantity' => 2]], $cebuEmployee, $cebu->id);
    echo "{$label}: {$transfer->transfer_number}\n";
}

$shortAccepted = $service->create(['remarks' => 'Click-through short accepted'], [['item_id' => $syringe->id, 'quantity' => 5]], $cebuEmployee, $cebu->id);
$shortAccepted = $service->approve($shortAccepted, $approver, $main->id);
$shortAccepted->items()->update(['quantity_picked' => 5, 'quantity_received' => 3]);
$shortAccepted->update(['status' => 'shipped', 'shipped_at' => now()]);
app(ReceivingService::class)->complete($shortAccepted->fresh(), $cebu->id);
app(DiscrepancyService::class)->resolve($shortAccepted->discrepancies()->firstOrFail(), $cebuEmployee, $cebu->id, 'accepted', 'Two syringes broke in transit.');
echo "short accepted: {$shortAccepted->transfer_number}\n";

$gauze = Item::factory()->create([
    'name' => 'Gauze Pad 4x4', 'sku' => 'GZE-44', 'barcode' => '4800001000059',
    'category_id' => $category->id, 'unit_id' => $pieces->id, 'has_expiry' => false,
]);
Batch::factory()->create(['item_id' => $gauze->id, 'branch_id' => $main->id, 'batch_number' => 'GZE-MAIN', 'quantity' => 1, 'expiry_date' => null]);
$purchaseOrders->create(
    ['supplier_id' => $acme->id, 'branch_id' => $main->id, 'remarks' => 'Click-through incoming gauze'],
    [['item_id' => $gauze->id, 'quantity_ordered' => 10, 'unit_cost' => 3]],
    $approver,
);
$coveredShortage = $service->create(['remarks' => 'Click-through covered shortage'], [['item_id' => $gauze->id, 'quantity' => 6]], $cebuEmployee, $cebu->id);
$service->approve($coveredShortage, $approver, $main->id);
echo "covered shortage: {$coveredShortage->transfer_number}\n";
