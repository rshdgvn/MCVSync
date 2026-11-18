<?php

require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Discrepancy;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\EmployeeRoleAssignmentService;
use App\Services\PurchaseOrderService;
use App\Services\TransferService;

$purchasing = User::where('email', 'purchasing@mcvsync.test')->firstOrFail()->employee;
$main = Branch::where('is_main', true)->firstOrFail();
$cebu = Branch::where('code', 'CEBU')->firstOrFail();

$category = Category::create(['name' => 'Consumables']);
$pieces = Unit::create(['code' => 'pcs', 'name' => 'Pieces']);
$gloves = Item::factory()->create(['name' => 'Surgical Gloves Medium', 'sku' => 'GLV-M-100', 'category_id' => $category->id, 'unit_id' => $pieces->id, 'expiry_alert_threshold_days' => 30]);
$masks = Item::factory()->create(['name' => 'Face Mask Box', 'sku' => 'MSK-50', 'category_id' => $category->id, 'unit_id' => $pieces->id, 'reorder_point' => 50]);
$thermometer = Item::factory()->create(['name' => 'Digital Thermometer', 'sku' => 'THM-01', 'category_id' => $category->id, 'unit_id' => $pieces->id, 'reorder_point' => 10, 'has_expiry' => false]);
$shield = Item::factory()->create(['name' => 'Face Shield', 'sku' => 'FSH-01', 'category_id' => $category->id, 'unit_id' => $pieces->id]);

Batch::factory()->create(['item_id' => $gloves->id, 'branch_id' => $main->id, 'batch_number' => 'GLV-SOON', 'quantity' => 40, 'expiry_date' => now()->addDays(10)->toDateString()]);
Batch::factory()->create(['item_id' => $masks->id, 'branch_id' => $main->id, 'batch_number' => 'MSK-LOW', 'quantity' => 5, 'expiry_date' => now()->addYear()->toDateString()]);

$supplier = Supplier::create(['name' => 'Luzon Surgical Corp']);
$orders = app(PurchaseOrderService::class);
$older = $orders->create(['supplier_id' => $supplier->id, 'branch_id' => $main->id, 'order_date' => now()->subDays(12)->toDateString()], [['item_id' => $masks->id, 'quantity_ordered' => 100, 'unit_cost' => 120]], $purchasing);
$newer = $orders->create(['supplier_id' => $supplier->id, 'branch_id' => $main->id], [['item_id' => $thermometer->id, 'quantity_ordered' => 20, 'unit_cost' => 350]], $purchasing);
$older->update(['status' => 'ready_for_delivery']);
$newer->update(['status' => 'ready_for_delivery']);

$discrepancy = Discrepancy::create([
    'reference_type' => 'purchase_order',
    'reference_id' => $older->id,
    'item_id' => $shield->id,
    'type' => 'not_found',
    'scanned_quantity' => 2,
    'notes' => 'Click-through not on document',
]);
$discrepancy->forceFill(['created_at' => now()->subDays(5)])->save();

$cebuEmployee = app(AccountProvisioningService::class)->createStaff([
    'name' => 'Cebu Purchasing',
    'email' => 'cebu.purchasing@mcvsync.test',
    'password' => getenv('SEED_USER_PASSWORD'),
], branchId: $cebu->id, position: 'Purchasing Officer');
app(EmployeeRoleAssignmentService::class)->assign($cebuEmployee, 'purchasing');

$transfers = app(TransferService::class);
$pending = $transfers->create(['remarks' => 'Click-through pending'], [['item_id' => $gloves->id, 'quantity' => 5]], $cebuEmployee, $cebu->id);
$transfers->approve($pending, $purchasing, $purchasing->branch_id);
$awaiting = $transfers->create(['remarks' => 'Click-through awaiting approval'], [['item_id' => $gloves->id, 'quantity' => 1]], $cebuEmployee, $cebu->id);
$awaiting->forceFill(['created_at' => now()->subDays(2)])->save();
$shipped = $transfers->create(['remarks' => 'Click-through shipped'], [['item_id' => $masks->id, 'quantity' => 2]], $cebuEmployee, $cebu->id);
$shipped->items()->update(['quantity_picked' => 2]);
$shipped->update(['status' => 'shipped', 'shipped_at' => now()]);

$shield->update(['reorder_point' => 10]);
$draft = $orders->draftForLowStock($shield->id, $main->id);
echo "low stock draft: {$draft->po_number}
";
echo "home fixtures ready: {$older->po_number} is the oldest ready PO\n";
