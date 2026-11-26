<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Models\Employee;
use App\Models\IncomingClientMessage;
use App\Models\Item;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Models\TransferRequest;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\AccountProvisioningService;
use App\Services\BatchAllocationService;
use App\Services\ClientOrderFormService;
use App\Services\ClientSubmissionService;
use App\Services\DeliveryService;
use App\Services\DiscountService;
use App\Services\EmployeeRoleAssignmentService;
use App\Services\FulfillmentService;
use App\Services\IncomingMessageService;
use App\Services\InventoryService;
use App\Services\PaymentService;
use App\Services\PricingService;
use App\Services\PurchaseOrderService;
use App\Services\ReceivingService;
use App\Services\TransferService;
use App\Support\BusinessDate;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;

class DemoDataSeeder extends Seeder
{
    public const MARKER_SKU = 'GLV-NIT-M';

    private const UNITS = [
        'box' => 'Box',
        'pack' => 'Pack',
        'pcs' => 'Pieces',
        'btl' => 'Bottle',
        'roll' => 'Roll',
        'vial' => 'Vial',
        'gal' => 'Gallon',
    ];

    private const ZONES = ['Cebu Metro', 'Davao Region'];

    private const SUPPLIERS = [
        'luzon' => ['name' => 'Luzon MedSupply Trading', 'contact_person' => 'Marites Dela Cruz', 'phone' => '0917 555 0101', 'email' => 'orders@luzonmedsupply.test', 'address' => 'Quezon City, Metro Manila'],
        'pacific' => ['name' => 'Pacific Surgical Distributors', 'contact_person' => 'Ramon Villanueva', 'phone' => '0918 555 0102', 'email' => 'sales@pacificsurgical.test', 'address' => 'Pasig City, Metro Manila'],
        'visayas' => ['name' => 'Visayas Pharma Wholesale', 'contact_person' => 'Liza Gonzaga', 'phone' => '0927 555 0103', 'email' => 'orders@visayaspharma.test', 'address' => 'Cebu City, Cebu'],
        'mindanao' => ['name' => 'Mindanao Health Supplies', 'contact_person' => 'Datu Alonto', 'phone' => '0935 555 0104', 'email' => 'supply@mindanaohealth.test', 'address' => 'Davao City, Davao del Sur'],
        'cleancare' => ['name' => 'CleanCare Industrial Chemicals', 'contact_person' => 'Joy Manalo', 'phone' => '0945 555 0105', 'email' => 'orders@cleancare.test', 'address' => 'Valenzuela City, Metro Manila'],
    ];

    private const ITEMS = [
        ['sku' => 'GLV-NIT-M', 'name' => 'Nitrile Examination Gloves Medium', 'category' => 'Gloves & PPE', 'unit' => 'box', 'expires' => true, 'reorder' => [40, 100], 'supplier' => 'luzon', 'cost' => 185, 'srp' => 260],
        ['sku' => 'GLV-NIT-L', 'name' => 'Nitrile Examination Gloves Large', 'category' => 'Gloves & PPE', 'unit' => 'box', 'expires' => true, 'reorder' => [30, 80], 'supplier' => 'luzon', 'cost' => 185, 'srp' => 260],
        ['sku' => 'GLV-LTX-7', 'name' => 'Latex Surgical Gloves Size 7', 'category' => 'Gloves & PPE', 'unit' => 'box', 'expires' => true, 'reorder' => [20, 50], 'supplier' => 'pacific', 'cost' => 420, 'srp' => 560],
        ['sku' => 'MSK-3PLY', 'name' => 'Surgical Face Mask 3-Ply', 'category' => 'Gloves & PPE', 'unit' => 'box', 'expires' => true, 'reorder' => [50, 120], 'supplier' => 'luzon', 'cost' => 95, 'srp' => 150],
        ['sku' => 'MSK-KN95', 'name' => 'KN95 Respirator', 'category' => 'Gloves & PPE', 'unit' => 'box', 'expires' => true, 'reorder' => [15, 40], 'supplier' => 'luzon', 'cost' => 380, 'srp' => 520],
        ['sku' => 'GWN-ISO', 'name' => 'Disposable Isolation Gown', 'category' => 'Gloves & PPE', 'unit' => 'pack', 'expires' => false, 'reorder' => [10, 30], 'supplier' => 'pacific', 'cost' => 650, 'srp' => 850],
        ['sku' => 'FSH-STD', 'name' => 'Face Shield', 'category' => 'Gloves & PPE', 'unit' => 'pcs', 'expires' => false, 'reorder' => null, 'supplier' => 'pacific', 'cost' => 25, 'srp' => 45],
        ['sku' => 'CAP-BFT', 'name' => 'Bouffant Cap', 'category' => 'Gloves & PPE', 'unit' => 'pack', 'expires' => false, 'reorder' => null, 'supplier' => 'luzon', 'cost' => 120, 'srp' => 180],
        ['sku' => 'SYR-1ML', 'name' => 'Disposable Syringe 1ml', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [30, 80], 'supplier' => 'pacific', 'cost' => 210, 'srp' => 300],
        ['sku' => 'SYR-3ML', 'name' => 'Disposable Syringe 3ml', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [30, 80], 'supplier' => 'pacific', 'cost' => 230, 'srp' => 320],
        ['sku' => 'SYR-5ML', 'name' => 'Disposable Syringe 5ml', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [30, 80], 'supplier' => 'pacific', 'cost' => 250, 'srp' => 350],
        ['sku' => 'SYR-10ML', 'name' => 'Disposable Syringe 10ml', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [20, 50], 'supplier' => 'pacific', 'cost' => 290, 'srp' => 400],
        ['sku' => 'NDL-G23', 'name' => 'Hypodermic Needle G23', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [20, 50], 'supplier' => 'pacific', 'cost' => 160, 'srp' => 240],
        ['sku' => 'IVC-G22', 'name' => 'IV Cannula G22', 'category' => 'Syringes & Needles', 'unit' => 'box', 'expires' => true, 'reorder' => [10, 30], 'supplier' => 'pacific', 'cost' => 1450, 'srp' => 1900],
        ['sku' => 'IVS-ADM', 'name' => 'IV Administration Set', 'category' => 'Syringes & Needles', 'unit' => 'pcs', 'expires' => true, 'reorder' => [50, 150], 'supplier' => 'pacific', 'cost' => 38, 'srp' => 60],
        ['sku' => 'GZE-4X4', 'name' => 'Sterile Gauze Pad 4x4', 'category' => 'Wound Care', 'unit' => 'pack', 'expires' => true, 'reorder' => [40, 100], 'supplier' => 'luzon', 'cost' => 75, 'srp' => 120],
        ['sku' => 'BND-ELS-4', 'name' => 'Elastic Bandage 4 inch', 'category' => 'Wound Care', 'unit' => 'roll', 'expires' => false, 'reorder' => [20, 60], 'supplier' => 'luzon', 'cost' => 32, 'srp' => 55],
        ['sku' => 'TPE-MCP-1', 'name' => 'Micropore Surgical Tape 1 inch', 'category' => 'Wound Care', 'unit' => 'box', 'expires' => true, 'reorder' => [15, 40], 'supplier' => 'luzon', 'cost' => 340, 'srp' => 460],
        ['sku' => 'CTN-300', 'name' => 'Cotton Balls 300s', 'category' => 'Wound Care', 'unit' => 'pack', 'expires' => false, 'reorder' => null, 'supplier' => 'luzon', 'cost' => 65, 'srp' => 99],
        ['sku' => 'BND-STR', 'name' => 'Adhesive Bandage Strips', 'category' => 'Wound Care', 'unit' => 'box', 'expires' => true, 'reorder' => null, 'supplier' => 'luzon', 'cost' => 110, 'srp' => 165],
        ['sku' => 'PVI-120', 'name' => 'Povidone-Iodine Solution 120ml', 'category' => 'Wound Care', 'unit' => 'btl', 'expires' => true, 'reorder' => [25, 60], 'supplier' => 'visayas', 'cost' => 78, 'srp' => 125],
        ['sku' => 'THM-DIG', 'name' => 'Digital Thermometer', 'category' => 'Diagnostics', 'unit' => 'pcs', 'expires' => false, 'reorder' => [10, 30], 'supplier' => 'mindanao', 'cost' => 145, 'srp' => 230],
        ['sku' => 'GLU-STR-50', 'name' => 'Blood Glucose Test Strips 50s', 'category' => 'Diagnostics', 'unit' => 'box', 'expires' => true, 'reorder' => [15, 40], 'supplier' => 'mindanao', 'cost' => 720, 'srp' => 950],
        ['sku' => 'LNC-100', 'name' => 'Blood Lancets 100s', 'category' => 'Diagnostics', 'unit' => 'box', 'expires' => true, 'reorder' => [15, 40], 'supplier' => 'mindanao', 'cost' => 180, 'srp' => 260],
        ['sku' => 'URN-CUP', 'name' => 'Urine Specimen Cup', 'category' => 'Diagnostics', 'unit' => 'pack', 'expires' => false, 'reorder' => null, 'supplier' => 'mindanao', 'cost' => 140, 'srp' => 210],
        ['sku' => 'OXM-FNG', 'name' => 'Fingertip Pulse Oximeter', 'category' => 'Diagnostics', 'unit' => 'pcs', 'expires' => false, 'reorder' => [5, 15], 'supplier' => 'mindanao', 'cost' => 650, 'srp' => 950],
        ['sku' => 'RAT-KIT', 'name' => 'Rapid Antigen Test Kit 25s', 'category' => 'Diagnostics', 'unit' => 'box', 'expires' => true, 'reorder' => [10, 25], 'supplier' => 'mindanao', 'cost' => 1800, 'srp' => 2400],
        ['sku' => 'MED-PCM-500', 'name' => 'Paracetamol 500mg Tablet 100s', 'category' => 'Medicines', 'unit' => 'box', 'expires' => true, 'reorder' => [30, 80], 'supplier' => 'visayas', 'cost' => 120, 'srp' => 185],
        ['sku' => 'MED-AMX-500', 'name' => 'Amoxicillin 500mg Capsule 100s', 'category' => 'Medicines', 'unit' => 'box', 'expires' => true, 'reorder' => [20, 50], 'supplier' => 'visayas', 'cost' => 480, 'srp' => 650],
        ['sku' => 'MED-NSS-1L', 'name' => 'Sodium Chloride 0.9% 1L', 'category' => 'Medicines', 'unit' => 'btl', 'expires' => true, 'reorder' => [40, 100], 'supplier' => 'visayas', 'cost' => 55, 'srp' => 85],
        ['sku' => 'MED-LDC-2', 'name' => 'Lidocaine 2% Injection 50ml', 'category' => 'Medicines', 'unit' => 'vial', 'expires' => true, 'reorder' => [20, 50], 'supplier' => 'visayas', 'cost' => 48, 'srp' => 75],
        ['sku' => 'MED-ORS', 'name' => 'Oral Rehydration Salts 25s', 'category' => 'Medicines', 'unit' => 'pack', 'expires' => true, 'reorder' => null, 'supplier' => 'visayas', 'cost' => 95, 'srp' => 140],
        ['sku' => 'ALC-ISO-500', 'name' => 'Isopropyl Alcohol 70% 500ml', 'category' => 'Disinfectants', 'unit' => 'btl', 'expires' => true, 'reorder' => [40, 120], 'supplier' => 'cleancare', 'cost' => 68, 'srp' => 105],
        ['sku' => 'ALC-ISO-GAL', 'name' => 'Isopropyl Alcohol 70% 1 Gallon', 'category' => 'Disinfectants', 'unit' => 'gal', 'expires' => true, 'reorder' => [10, 30], 'supplier' => 'cleancare', 'cost' => 420, 'srp' => 580],
        ['sku' => 'SNT-GEL-500', 'name' => 'Hand Sanitizer Gel 500ml', 'category' => 'Disinfectants', 'unit' => 'btl', 'expires' => true, 'reorder' => [20, 60], 'supplier' => 'cleancare', 'cost' => 110, 'srp' => 165],
        ['sku' => 'DSF-SPR', 'name' => 'Surface Disinfectant Spray 500ml', 'category' => 'Disinfectants', 'unit' => 'btl', 'expires' => true, 'reorder' => null, 'supplier' => 'cleancare', 'cost' => 190, 'srp' => 275],
        ['sku' => 'TDP-100', 'name' => 'Wooden Tongue Depressor 100s', 'category' => 'Consumables', 'unit' => 'pack', 'expires' => false, 'reorder' => null, 'supplier' => 'luzon', 'cost' => 60, 'srp' => 95],
        ['sku' => 'UPD-10', 'name' => 'Disposable Underpad 10s', 'category' => 'Consumables', 'unit' => 'pack', 'expires' => false, 'reorder' => [10, 30], 'supplier' => 'luzon', 'cost' => 145, 'srp' => 220],
        ['sku' => 'BAG-BIO', 'name' => 'Biohazard Specimen Bag 100s', 'category' => 'Consumables', 'unit' => 'pack', 'expires' => false, 'reorder' => null, 'supplier' => 'mindanao', 'cost' => 130, 'srp' => 195],
        ['sku' => 'THM-MRC', 'name' => 'Mercury Thermometer (Discontinued)', 'category' => 'Diagnostics', 'unit' => 'pcs', 'expires' => false, 'reorder' => null, 'supplier' => 'mindanao', 'cost' => 60, 'srp' => 90, 'inactive' => true],
    ];

    private const LOW_STOCK = ['MSK-KN95' => 12, 'IVC-G22' => 8, 'OXM-FNG' => 4, 'GLU-STR-50' => 10];

    private const NEAR_EXPIRY_DAYS = ['GLV-NIT-M' => 12, 'SYR-5ML' => 25, 'MED-PCM-500' => 40, 'GZE-4X4' => 55, 'ALC-ISO-500' => 70];

    private const STAFF = [
        ['key' => 'sales.cebu', 'name' => 'Cebu Sales Demo', 'branch' => 'CEBU', 'position' => 'Sales Associate', 'role' => 'sales'],
        ['key' => 'purchasing.cebu', 'name' => 'Cebu Purchasing Demo', 'branch' => 'CEBU', 'position' => 'Purchasing Officer', 'role' => 'purchasing'],
        ['key' => 'logistics.cebu', 'name' => 'Cebu Logistics Demo', 'branch' => 'CEBU', 'position' => 'Logistics Coordinator', 'role' => 'logistics'],
        ['key' => 'sales.davao', 'name' => 'Davao Sales Demo', 'branch' => 'DAVAO', 'position' => 'Sales Associate', 'role' => 'sales'],
        ['key' => 'purchasing.davao', 'name' => 'Davao Purchasing Demo', 'branch' => 'DAVAO', 'position' => 'Purchasing Officer', 'role' => 'purchasing'],
        ['key' => 'logistics.davao', 'name' => 'Davao Logistics Demo', 'branch' => 'DAVAO', 'position' => 'Logistics Coordinator', 'role' => 'logistics'],
    ];

    private const EXISTING_STAFF = [
        'sales.apalit' => 'sales@mcvsync.test',
        'purchasing.apalit' => 'purchasing@mcvsync.test',
        'accounting.apalit' => 'accounting@mcvsync.test',
        'logistics.apalit' => 'logistics@mcvsync.test',
    ];

    private const CLIENTS = [
        'raphael' => ['name' => 'St. Raphael Medical Clinic', 'address' => 'Malolos, Bulacan', 'contact' => '0917 555 0211', 'zone' => 'Pampanga/Bulacan', 'type' => 'direct', 'branch' => 'APALIT'],
        'apalitfhc' => ['name' => 'Apalit Family Health Center', 'address' => 'Sampaloc, Apalit, Pampanga', 'contact' => '0918 555 0212', 'zone' => 'Pampanga/Bulacan', 'type' => 'direct', 'branch' => 'APALIT'],
        'medserve' => ['name' => 'Bulacan MedServe Pharmacy', 'address' => 'Meycauayan, Bulacan', 'contact' => '0927 555 0213', 'zone' => 'Pampanga/Bulacan', 'type' => 'reseller', 'branch' => 'APALIT'],
        'lifeline' => ['name' => 'Lipa Lifeline Hospital', 'address' => 'Lipa City, Batangas', 'contact' => '0935 555 0214', 'zone' => 'South Luzon', 'type' => 'direct', 'branch' => 'APALIT'],
        'lagunacare' => ['name' => 'Laguna Care Diagnostics', 'address' => 'Calamba, Laguna', 'contact' => '0945 555 0215', 'zone' => 'South Luzon', 'type' => 'direct', 'branch' => 'APALIT'],
        'cebupoly' => ['name' => 'Cebu Doctors Polyclinic', 'address' => 'Lahug, Cebu City', 'contact' => '0917 555 0321', 'zone' => 'Cebu Metro', 'type' => 'direct', 'branch' => 'CEBU'],
        'mandaue' => ['name' => 'Mandaue Wellness Pharmacy', 'address' => 'Mandaue City, Cebu', 'contact' => '0918 555 0322', 'zone' => 'Cebu Metro', 'type' => 'reseller', 'branch' => 'CEBU'],
        'southpoint' => ['name' => 'Davao Southpoint Clinic', 'address' => 'Matina, Davao City', 'contact' => '0927 555 0431', 'zone' => 'Davao Region', 'type' => 'direct', 'branch' => 'DAVAO'],
    ];

    private const UNPRICED = [
        'RAT-KIT' => ['raphael', 'medserve'],
        'OXM-FNG' => ['demo', 'raphael', 'apalitfhc', 'medserve', 'lagunacare', 'cebupoly', 'mandaue', 'southpoint'],
        'IVC-G22' => ['lagunacare'],
    ];

    private const STANDING_DISCOUNTS = [
        ['client' => 'medserve', 'sku' => 'GLV-NIT-M', 'percent' => 5],
        ['client' => 'medserve', 'sku' => 'GLV-NIT-L', 'percent' => 5],
        ['client' => 'medserve', 'sku' => 'MSK-3PLY', 'percent' => 5],
        ['client' => 'raphael', 'sku' => 'SYR-3ML', 'percent' => 3],
        ['client' => 'raphael', 'sku' => 'SYR-5ML', 'percent' => 3],
        ['client' => 'mandaue', 'sku' => 'MED-PCM-500', 'percent' => 4],
    ];

    private CarbonImmutable $today;

    /** @var array<string, Item> */
    private array $items = [];

    /** @var array<string, array<string, mixed>> */
    private array $definitions = [];

    /** @var array<string, Employee> */
    private array $staff = [];

    /** @var array<string, Client> */
    private array $clients = [];

    /** @var array<string, Supplier> */
    private array $suppliers = [];

    /** @var array<string, int> */
    private array $branchIds = [];

    public function run(): void
    {
        if (! config('services.demo_data')) {
            return;
        }

        if (Item::query()->where('sku', self::MARKER_SKU)->exists()) {
            $this->command?->warn('Demo data is already seeded. Skipping.');

            return;
        }

        if (! config('services.seed_user_password') || ! User::query()->where('email', 'client@mcvsync.test')->exists()) {
            $this->command?->error('Set SEED_USER_PASSWORD so the demo accounts exist first.');

            return;
        }

        config(['broadcasting.default' => 'null', 'queue.default' => 'sync']);
        $this->today = CarbonImmutable::now(config('mcvsync.business_timezone'))->startOfDay();
        $this->branchIds = Branch::query()->pluck('id', 'code')->map(fn ($id) => (int) $id)->all();
        $this->definitions = collect(self::ITEMS)->keyBy('sku')->all();

        try {
            $this->at(85);
            $this->catalog();
            $this->accounts();
            $this->pricing();
            $this->stock();
            $this->transfers();
            $this->completedOrders();
            $this->priceIncrease();
            $this->openOrders();
            $this->messages();
        } finally {
            $this->backToNow();
        }

        $this->command?->info('Demo data seeded.');
    }

    private function catalog(): void
    {
        $inventory = app(InventoryService::class);
        $units = collect(self::UNITS)->map(fn (string $name, string $code) => Unit::query()->firstOrCreate(['code' => $code], ['name' => $name]));
        $categories = collect(self::ITEMS)->pluck('category')->unique()
            ->mapWithKeys(fn (string $name) => [$name => Category::query()->firstOrCreate(['name' => $name])]);

        foreach (self::SUPPLIERS as $key => $supplier) {
            $this->suppliers[$key] = Supplier::query()->create($supplier);
        }

        foreach (self::ITEMS as $index => $item) {
            $this->items[$item['sku']] = $inventory->createItem([
                'name' => $item['name'],
                'sku' => $item['sku'],
                'barcode' => sprintf('480%010d', 7100000 + $index),
                'category_id' => $categories[$item['category']]->id,
                'unit_id' => $units[$item['unit']]->id,
                'has_expiry' => $item['expires'],
                'reorder_point' => $item['reorder'][0] ?? null,
                'reorder_quantity' => $item['reorder'][1] ?? null,
                'preferred_supplier_id' => $this->suppliers[$item['supplier']]->id,
                'is_active' => ! ($item['inactive'] ?? false),
            ]);
        }
    }

    private function accounts(): void
    {
        $provisioning = app(AccountProvisioningService::class);
        $roles = app(EmployeeRoleAssignmentService::class);
        $password = config('services.seed_user_password');

        foreach (self::EXISTING_STAFF as $key => $email) {
            $this->staff[$key] = User::query()->where('email', $email)->firstOrFail()->employee;
        }

        foreach (self::STAFF as $account) {
            $employee = $provisioning->createStaff(
                ['name' => $account['name'], 'email' => "{$account['key']}@mcvsync.test", 'password' => $password],
                branchId: $this->branchIds[$account['branch']],
                position: $account['position'],
            );
            $roles->assign($employee, $account['role']);
            $this->staff[$account['key']] = $employee;
        }

        foreach (self::ZONES as $zone) {
            Zone::query()->firstOrCreate(['name' => $zone]);
        }
        $zones = Zone::query()->pluck('id', 'name');

        $this->clients['demo'] = Client::query()->whereHas('user', fn ($query) => $query->where('email', 'client@mcvsync.test'))->firstOrFail();

        foreach (self::CLIENTS as $key => $client) {
            $this->clients[$key] = $provisioning->createClient(
                ['name' => $client['name'], 'email' => "{$key}@mcvsync.test", 'password' => $password],
                [
                    'address' => $client['address'],
                    'contact' => $client['contact'],
                    'zone_id' => $zones[$client['zone']],
                    'client_type' => $client['type'],
                    'branch_id' => $this->branchIds[$client['branch']],
                ],
            );
        }
    }

    private function pricing(): void
    {
        $pricing = app(PricingService::class);
        $discounts = app(DiscountService::class);
        $accounting = $this->staff['accounting.apalit'];
        $clientIndex = 0;

        foreach ($this->clients as $key => $client) {
            $resellerRate = $client->client_type === 'reseller' ? 0.92 : 1.0;

            foreach (self::ITEMS as $itemIndex => $item) {
                if (($item['inactive'] ?? false) || in_array($key, self::UNPRICED[$item['sku']] ?? [], true)) {
                    continue;
                }

                $variation = 1 + ((($clientIndex * 7 + $itemIndex * 3) % 9) - 4) / 100;
                $pricing->setPrice($client->id, $this->items[$item['sku']]->id, round($item['srp'] * $resellerRate * $variation, 2), $accounting);
            }
            $clientIndex++;
        }

        foreach (self::STANDING_DISCOUNTS as $discount) {
            $discounts->setDiscount($this->clients[$discount['client']]->id, $this->items[$discount['sku']]->id, $discount['percent'], $this->staff['sales.apalit']);
        }
    }

    private function priceIncrease(): void
    {
        $pricing = app(PricingService::class);
        $accounting = $this->staff['accounting.apalit'];

        $this->at(5, '08:00');
        foreach (['raphael', 'lifeline'] as $key) {
            foreach (['GLV-NIT-M', 'MSK-3PLY'] as $sku) {
                $current = $pricing->currentPrice($this->clients[$key]->id, $this->items[$sku]->id);
                $pricing->setPrice($this->clients[$key]->id, $this->items[$sku]->id, round((float) $current->srp * 1.06, 2), $accounting);
            }
        }
    }

    private function stock(): void
    {
        $purchasing = app(PurchaseOrderService::class);
        $apalitBuyer = $this->staff['purchasing.apalit'];

        $this->at(75);
        foreach (array_keys(self::SUPPLIERS) as $supplier) {
            $lines = collect(self::ITEMS)
                ->filter(fn (array $item) => $item['supplier'] === $supplier && ! ($item['inactive'] ?? false))
                ->mapWithKeys(fn (array $item) => [$item['sku'] => self::LOW_STOCK[$item['sku']] ?? 300])
                ->all();
            $order = $this->purchaseOrder('APALIT', $supplier, $lines, $apalitBuyer, 'Opening stock for the Apalit warehouse.');
            $this->at(73);
            $this->receive($order, $apalitBuyer);
            $this->at(75);
        }

        $this->at(42);
        $nearExpiry = $this->purchaseOrder('APALIT', 'luzon', array_fill_keys(array_keys(self::NEAR_EXPIRY_DAYS), 120), $apalitBuyer, 'Clearance lot with short expiry, sell first.');
        $this->at(40);
        $this->receive($nearExpiry, $apalitBuyer, expiries: array_map(fn (int $days) => $this->today->addDays($days)->toDateString(), self::NEAR_EXPIRY_DAYS));

        $this->at(62);
        $cebuBuyer = $this->staff['purchasing.cebu'];
        $cebuOrder = $this->purchaseOrder('CEBU', 'visayas', ['MED-PCM-500' => 120, 'MED-AMX-500' => 60, 'MED-NSS-1L' => 150, 'MED-LDC-2' => 80, 'MED-ORS' => 60, 'PVI-120' => 90], $cebuBuyer, 'Cebu medicines restock.');
        $this->at(60);
        $this->receive($cebuOrder, $cebuBuyer);

        $this->at(58);
        $davaoBuyer = $this->staff['purchasing.davao'];
        $davaoOrder = $this->purchaseOrder('DAVAO', 'mindanao', ['THM-DIG' => 40, 'GLU-STR-50' => 30, 'LNC-100' => 40, 'URN-CUP' => 50, 'BAG-BIO' => 30], $davaoBuyer, 'Davao diagnostics opening stock.');
        $this->at(56);
        $this->receive($davaoOrder, $davaoBuyer);

        $this->at(12);
        $partial = $this->purchaseOrder('APALIT', 'pacific', ['SYR-1ML' => 100, 'SYR-3ML' => 100, 'NDL-G23' => 80, 'IVS-ADM' => 200], $apalitBuyer, 'Monthly syringe replenishment.');
        $this->at(10);
        $this->receive($partial, $apalitBuyer, quantities: ['NDL-G23' => 50]);

        $this->at(9);
        $purchasing->draftForLowStock($this->items['IVC-G22']->id, $this->branchIds['APALIT']);

        $this->at(6);
        $duplicate = $this->purchaseOrder('APALIT', 'luzon', ['CAP-BFT' => 50, 'TDP-100' => 40], $apalitBuyer, 'Duplicate of last week\'s order.');
        $this->at(5);
        $purchasing->cancel($duplicate);

        $this->at(4);
        $incoming = $this->purchaseOrder('APALIT', 'mindanao', ['OXM-FNG' => 15, 'GLU-STR-50' => 40, 'RAT-KIT' => 20], $apalitBuyer, 'Diagnostics restock, supplier confirmed dispatch.');
        $purchasing->markReady($incoming);

        $this->at(1);
        $this->purchaseOrder('APALIT', 'cleancare', ['ALC-ISO-GAL' => 30, 'SNT-GEL-500' => 60, 'DSF-SPR' => 40], $apalitBuyer, 'Disinfectant restock for the rainy season.');
    }

    private function transfers(): void
    {
        $transfers = app(TransferService::class);
        $cebu = $this->branchIds['CEBU'];
        $cebuRequester = $this->staff['logistics.cebu'];
        $approver = $this->staff['purchasing.apalit'];
        $picker = $this->staff['logistics.apalit'];
        $request = fn (array $lines, string $remarks, Employee $requester, int $branchId) => $transfers->create(
            ['remarks' => $remarks],
            collect($lines)->map(fn (int $quantity, string $sku) => ['item_id' => $this->items[$sku]->id, 'quantity' => $quantity])->values()->all(),
            $requester,
            $branchId,
        );

        $this->at(50);
        $received = $request(['GLV-NIT-M' => 40, 'MSK-3PLY' => 60, 'SYR-5ML' => 30, 'ALC-ISO-500' => 50], 'Restock PPE and syringes for Cebu clinics.', $cebuRequester, $cebu);
        $this->at(49);
        $transfers->approve($received, $approver, null);
        $this->pickTransfer($received, $picker);
        $this->at(48);
        $transfers->ship($received->fresh(), null);
        $this->at(46);
        $this->receiveTransfer($received->fresh(), $this->staff['purchasing.cebu']);

        $this->at(20);
        $declined = $request(['MSK-KN95' => 10], 'Hospital client asked for KN95s.', $cebuRequester, $cebu);
        $this->at(19);
        $transfers->decline($declined, $approver, null, 'KN95 stock is reserved for Apalit hospital orders this week.');

        $this->at(8);
        $withdrawn = $request(['THM-DIG' => 10], 'Thermometers for the school clinic contract.', $cebuRequester, $cebu);
        $transfers->cancel($withdrawn, $cebu);

        $this->at(3);
        $shipped = $request(['GZE-4X4' => 30, 'BND-ELS-4' => 40, 'TPE-MCP-1' => 10], 'Wound care restock.', $cebuRequester, $cebu);
        $transfers->approve($shipped, $approver, null);
        $this->at(2);
        $this->pickTransfer($shipped, $picker);
        $transfers->ship($shipped->fresh(), null);

        $this->at(1);
        $pending = $request(['GLV-NIT-L' => 30, 'CAP-BFT' => 20], 'Gloves for the new dental client.', $cebuRequester, $cebu);
        $transfers->approve($pending, $approver, null);
        $request(['MSK-3PLY' => 40, 'SNT-GEL-500' => 24, 'SYR-3ML' => 20], 'Davao needs PPE and syringes for clinic orders.', $this->staff['logistics.davao'], $this->branchIds['DAVAO']);
    }

    private function completedOrders(): void
    {
        $orders = [
            ['client' => 'raphael', 'days' => 72, 'terms' => '30 Days', 'paid' => true, 'lines' => ['GLV-NIT-M' => 20, 'SYR-3ML' => 10, 'GZE-4X4' => 15]],
            ['client' => 'medserve', 'days' => 65, 'terms' => '15 Days', 'paid' => true, 'lines' => ['MSK-3PLY' => 40, 'ALC-ISO-500' => 36, 'CTN-300' => 20]],
            ['client' => 'lifeline', 'days' => 58, 'terms' => '30 Days', 'paid' => true, 'lines' => ['IVS-ADM' => 60, 'SYR-10ML' => 10, 'MED-NSS-1L' => 48, 'GWN-ISO' => 5]],
            ['client' => 'demo', 'days' => 50, 'terms' => '30 Days', 'paid' => false, 'lines' => ['GLV-NIT-L' => 10, 'BND-STR' => 6]],
            ['client' => 'lagunacare', 'days' => 44, 'terms' => 'COD', 'paid' => true, 'lines' => ['LNC-100' => 8, 'URN-CUP' => 10, 'BAG-BIO' => 5]],
            ['client' => 'apalitfhc', 'days' => 37, 'terms' => '15 Days', 'paid' => false, 'lines' => ['MED-PCM-500' => 12, 'THM-DIG' => 6, 'TDP-100' => 4]],
            ['client' => 'raphael', 'days' => 30, 'terms' => '30 Days', 'paid' => true, 'lines' => ['GLV-NIT-M' => 25, 'NDL-G23' => 10, 'TPE-MCP-1' => 6]],
            ['client' => 'medserve', 'days' => 22, 'terms' => '30 Days', 'paid' => false, 'lines' => ['GLV-NIT-M' => 30, 'SNT-GEL-500' => 24]],
            ['client' => 'lifeline', 'days' => 15, 'terms' => '30 Days', 'paid' => false, 'lines' => ['IVC-G22' => 2, 'MED-LDC-2' => 20, 'SYR-5ML' => 12]],
            ['client' => 'demo', 'days' => 9, 'terms' => '15 Days', 'paid' => false, 'lines' => ['MSK-3PLY' => 20, 'ALC-ISO-500' => 12]],
            ['client' => 'cebupoly', 'days' => 40, 'terms' => '30 Days', 'paid' => false, 'lines' => ['MED-AMX-500' => 10, 'MED-PCM-500' => 15, 'GLV-NIT-M' => 10]],
            ['client' => 'mandaue', 'days' => 18, 'terms' => '15 Days', 'paid' => false, 'lines' => ['MED-PCM-500' => 30, 'PVI-120' => 24, 'MSK-3PLY' => 20]],
            ['client' => 'southpoint', 'days' => 30, 'terms' => '30 Days', 'paid' => false, 'lines' => ['GLU-STR-50' => 6, 'LNC-100' => 6, 'THM-DIG' => 4]],
        ];

        foreach ($orders as $order) {
            $this->at($order['days'], '09:20');
            $cof = $this->portalOrder($order['client'], $order['lines'], 'Regular monthly order.');
            $this->approveAndForward($cof, $order['terms']);
            $this->at($order['days'] - 1, '08:40');
            $this->pickOrder($cof);
            $this->at($order['days'] - 2, '15:10');
            $this->deliver($cof, 'Receiving clerk');
            $this->at($order['days'] - 3, '10:05');
            app(ClientOrderFormService::class)->confirmReceipt($cof->fresh());

            if ($order['paid']) {
                $this->at(max(1, $order['days'] - 14), '11:00');
                $this->pay($cof);
            }
        }
    }

    private function openOrders(): void
    {
        $service = app(ClientOrderFormService::class);

        $this->at(6, '09:30');
        $delivered = $this->portalOrder('apalitfhc', ['GLV-NIT-M' => 10, 'MSK-3PLY' => 15], 'Please deliver before Friday.');
        $this->approveAndForward($delivered, '15 Days');
        $this->pickOrder($delivered);
        $this->at(5, '14:00');
        $this->deliver($delivered, 'Nurse Joy Santos');

        $this->at(5, '10:15');
        $withIssue = $this->portalOrder('lagunacare', ['GLV-NIT-L' => 12, 'URN-CUP' => 10], null);
        $this->approveAndForward($withIssue, '30 Days');
        $this->pickOrder($withIssue);
        $this->at(4, '13:30');
        $this->deliver($withIssue, 'Mark Reyes');
        $this->at(3, '09:00');
        $service->reportIssue($withIssue->fresh(), 'Two boxes of gloves arrived with torn packaging.');

        $this->at(2, '10:00');
        $ready = $this->portalOrder('raphael', ['SYR-3ML' => 10, 'SYR-5ML' => 10, 'NDL-G23' => 8], 'Clinic restock.');
        $this->approveAndForward($ready, '30 Days');
        $this->pickOrder($ready);

        $this->at(2, '11:00');
        $cancelRequested = $this->portalOrder('medserve', ['ALC-ISO-GAL' => 4, 'SNT-GEL-500' => 12], null);
        $this->approveAndForward($cancelRequested, '30 Days');
        $this->pickOrder($cancelRequested);
        $this->at(1, '16:20');
        $service->requestCancellation($cancelRequested->fresh());

        $this->at(2, '13:00');
        $short = $this->portalOrder('demo', ['MSK-KN95' => 10, 'FSH-STD' => 20], 'Need KN95s for the flu season.');
        $this->approveAndForward($short, '30 Days');
        $this->at(1, '09:10');
        $this->pickOrder($short, ['MSK-KN95' => 6]);
        $service->completePicking($short->fresh(), null);

        $this->at(1, '10:30');
        $processing = $this->portalOrder('lifeline', ['IVS-ADM' => 40, 'MED-NSS-1L' => 30, 'GWN-ISO' => 4], 'For the surgical ward.');
        $this->approveAndForward($processing, '30 Days');
        $this->at(1, '15:00');
        $this->pickOrder($processing, ['IVS-ADM' => 40, 'MED-NSS-1L' => 12, 'GWN-ISO' => 0]);

        $this->at(33, '10:00');
        $service->cancel($this->portalOrder('lifeline', ['THM-DIG' => 10], 'Ordered by mistake.')->fresh());

        $this->at(28, '09:00');
        $cancelledAfterPicking = $this->portalOrder('apalitfhc', ['BND-ELS-4' => 20, 'CTN-300' => 10], null);
        $this->approveAndForward($cancelledAfterPicking, '15 Days');
        $this->pickOrder($cancelledAfterPicking);
        $this->at(27, '14:00');
        $service->requestCancellation($cancelledAfterPicking->fresh());
        $service->confirmCancellation($cancelledAfterPicking->fresh(), $this->staff['sales.apalit']);

        $this->at(3, '15:40');
        $revision = $this->portalOrder('lagunacare', ['IVS-ADM' => 30, 'SYR-1ML' => 10], 'Need these for next week.');
        $service->sendForRevision($revision, 'Please confirm the IV set quantity. 30 pieces is lower than your usual 100.');

        $this->at(1, '17:30');
        $this->portalOrder('demo', ['GLV-NIT-M' => 15, 'GZE-4X4' => 20, 'ALC-ISO-500' => 24], 'Same as last month please.');
        $this->portalOrder('raphael', ['RAT-KIT' => 4, 'MSK-3PLY' => 10], 'Adding antigen kits this time.');
        $this->portalOrder('apalitfhc', ['MED-PCM-500' => 10, 'THM-DIG' => 4, 'UPD-10' => 6], null);
        $this->portalOrder('mandaue', ['MED-PCM-500' => 20, 'MED-ORS' => 15], 'Weekly order.');
        $this->portalOrder('southpoint', ['GLU-STR-50' => 4, 'URN-CUP' => 6], null);
    }

    private function messages(): void
    {
        $messages = app(IncomingMessageService::class);
        $service = app(ClientOrderFormService::class);
        $log = function (string $client, string $channel, string $notes, int $hoursAgo, array $lines) use ($messages): IncomingClientMessage {
            $owner = $this->clients[$client];
            $sales = $owner->branch_id === $this->branchIds['CEBU'] ? $this->staff['sales.cebu'] : $this->staff['sales.apalit'];
            $receivedAt = CarbonImmutable::now()->subHours($hoursAgo);
            $this->moveTo($receivedAt->addMinutes(20));

            return $messages->log($owner, $channel, $this->orderSheet($owner, $lines, $channel), $receivedAt->toDateTimeString(), $notes, $sales);
        };

        $this->backToNow();
        $converted = $log('lagunacare', 'viber', 'Photo of their signed purchase order.', 27 * 24, ['LNC-100' => 6, 'URN-CUP' => 8]);
        $this->at(26, '11:00');
        $manual = $service->createManual(
            ['client_id' => $converted->client_id, 'incoming_message_id' => $converted->id, 'terms' => 'COD', 'remarks' => 'From Viber order.'],
            [['item_id' => $this->items['LNC-100']->id, 'quantity' => 6], ['item_id' => $this->items['URN-CUP']->id, 'quantity' => 8]],
            $this->staff['sales.apalit'],
        );
        $this->approveAndForward($manual, 'COD');
        $this->at(25, '09:00');
        $this->pickOrder($manual);
        $this->at(24, '14:00');
        $this->deliver($manual, 'Laboratory supervisor');
        $this->at(23, '10:00');
        $service->confirmReceipt($manual->fresh());
        $this->pay($manual);

        $this->backToNow();
        $pending = $log('medserve', 'email', 'Emailed PO from their purchasing officer.', 26, ['GLV-NIT-L' => 20, 'BND-ELS-4' => 30]);
        $this->moveTo(CarbonImmutable::now()->subHours(25));
        $service->createManual(
            ['client_id' => $pending->client_id, 'incoming_message_id' => $pending->id, 'terms' => '30 Days', 'remarks' => 'Emailed order.'],
            [['item_id' => $this->items['GLV-NIT-L']->id, 'quantity' => 20], ['item_id' => $this->items['BND-ELS-4']->id, 'quantity' => 30]],
            $this->staff['sales.apalit'],
        );

        $this->backToNow();
        $log('raphael', 'messenger', 'Screenshot of their handwritten order list.', 74, ['SYR-1ML' => 5, 'GZE-4X4' => 10]);
        $this->backToNow();
        $log('lifeline', 'email', 'PDF purchase order attached, needs delivery by next week.', 30, ['MED-NSS-1L' => 60, 'IVS-ADM' => 50]);
        $this->backToNow();
        $log('apalitfhc', 'viber', 'Voice note transcribed: paracetamol and alcohol.', 3, ['MED-PCM-500' => 6, 'ALC-ISO-500' => 12]);
        $this->backToNow();
        $log('cebupoly', 'messenger', 'Photo of order form from the clinic manager.', 50, ['MED-AMX-500' => 8, 'MED-NSS-1L' => 20]);
    }

    private function purchaseOrder(string $branch, string $supplier, array $lines, Employee $buyer, string $remarks): PurchaseOrder
    {
        return app(PurchaseOrderService::class)->create(
            [
                'supplier_id' => $this->suppliers[$supplier]->id,
                'branch_id' => $this->branchIds[$branch],
                'request_delivery_date' => BusinessDate::today()->addDays(3)->toDateString(),
                'terms' => '30 Days',
                'remarks' => $remarks,
            ],
            collect($lines)->map(fn (int $quantity, string $sku) => [
                'item_id' => $this->items[$sku]->id,
                'quantity_ordered' => $quantity,
                'unit_cost' => $this->definitions[$sku]['cost'],
            ])->values()->all(),
            $buyer,
        );
    }

    private function receive(PurchaseOrder $order, Employee $receiver, array $quantities = [], array $expiries = []): void
    {
        $receiving = app(ReceivingService::class);

        foreach ($order->items()->with('item')->get() as $line) {
            $sku = $line->item->sku;
            $quantity = $quantities[$sku] ?? $line->quantity_ordered;

            $receiving->confirm($order->fresh(), $line->id, [
                'quantity_received' => $quantity,
                'batch_number' => sprintf('%s-%s', $sku, BusinessDate::today()->format('ymd')),
                'expiry_date' => $line->item->has_expiry ? ($expiries[$sku] ?? $this->defaultExpiry($sku)) : null,
            ], $receiver, null);
        }

        $receiving->complete($order->fresh(), null);
    }

    private function pickTransfer(TransferRequest $transfer, Employee $picker): void
    {
        $fulfillment = app(FulfillmentService::class);

        foreach ($transfer->items()->get() as $line) {
            $this->pickInBatches($line->item_id, $transfer->fulfilling_branch_id, $line->quantity_requested - $line->quantity_picked,
                fn (int $quantity) => $fulfillment->pick($transfer->fresh(), ['item_id' => $line->item_id, 'quantity' => $quantity], $picker, null));
        }
    }

    private function receiveTransfer(TransferRequest $transfer, Employee $receiver): void
    {
        $receiving = app(ReceivingService::class);
        $picks = StockTransaction::query()
            ->where('reference_type', $transfer->getMorphClass())
            ->where('reference_id', $transfer->id)
            ->where('quantity', '<', 0)
            ->with('batch')
            ->get()
            ->groupBy(fn (StockTransaction $pick) => $pick->item_id.':'.$pick->batch_id);

        foreach ($transfer->items()->get() as $line) {
            foreach ($picks->filter(fn ($group) => $group->first()->item_id === $line->item_id) as $group) {
                $batch = $group->first()->batch;
                $receiving->confirm($transfer->fresh(), $line->id, [
                    'quantity_received' => -$group->sum('quantity'),
                    'batch_number' => $batch->batch_number,
                    'expiry_date' => $batch->expiry_date?->toDateString(),
                ], $receiver, null);
            }
        }

        $receiving->complete($transfer->fresh(), null);
    }

    private function portalOrder(string $client, array $lines, ?string $notes): ClientOrderForm
    {
        return app(ClientSubmissionService::class)->submit(
            $this->clients[$client],
            collect($lines)->map(fn (int $quantity, string $sku) => ['item_id' => $this->items[$sku]->id, 'quantity' => $quantity])->values()->all(),
            $notes,
        );
    }

    private function approveAndForward(ClientOrderForm $cof, string $terms): void
    {
        $service = app(ClientOrderFormService::class);
        $service->update($cof->fresh(), ['terms' => $terms, 'request_delivery_date' => BusinessDate::today()->addDays(2)->toDateString()], null);
        $service->forward($cof->fresh(), $this->staffAt('sales', $cof->branch_id));
    }

    private function pickOrder(ClientOrderForm $cof, array $limits = []): void
    {
        $service = app(ClientOrderFormService::class);
        $picker = $this->staffAt('logistics', $cof->branch_id);

        foreach ($cof->items()->with('item')->get() as $line) {
            $target = $limits[$line->item->sku] ?? $line->quantity;
            $this->pickInBatches($line->item_id, $cof->branch_id, $target - $line->quantity_picked,
                fn (int $quantity) => $service->pick($cof->fresh(), ['item_id' => $line->item_id, 'quantity' => $quantity], $picker, null));
        }
    }

    private function pickInBatches(int $itemId, int $branchId, int $remaining, callable $pick): void
    {
        $batches = app(BatchAllocationService::class);

        while ($remaining > 0) {
            $batch = $batches->nextAvailableBatch($itemId, $branchId);
            $quantity = min($remaining, (int) $batch->quantity);
            $pick($quantity);
            $remaining -= $quantity;
        }
    }

    private function deliver(ClientOrderForm $cof, string $receivedBy): void
    {
        app(DeliveryService::class)->confirm(
            $cof->fresh(),
            ['delivery_date' => BusinessDate::todayString(), 'received_by' => $receivedBy],
            $this->staffAt('logistics', $cof->branch_id),
            null,
        );
    }

    private function pay(ClientOrderForm $cof): void
    {
        $payment = Payment::query()->where('reference_type', $cof->getMorphClass())->where('reference_id', $cof->id)->firstOrFail();

        app(PaymentService::class)->approve($payment, [
            'method' => $payment->payment_terms === 'COD' ? 'cash' : 'bank_transfer',
            'date_received' => BusinessDate::todayString(),
            'reference_note' => $payment->payment_terms === 'COD' ? 'Collected on delivery.' : 'BDO deposit slip '.(80000 + $cof->id),
        ], $this->staff['accounting.apalit']);
    }

    private function staffAt(string $role, int $branchId): Employee
    {
        $branch = strtolower((string) array_search($branchId, $this->branchIds, true));

        return $this->staff["{$role}.{$branch}"];
    }

    private function orderSheet(Client $client, array $lines, string $channel): UploadedFile
    {
        $rows = collect($lines)->map(fn (int $quantity, string $sku) => sprintf('%d x %s', $quantity, $this->items[$sku]->name))->values()->all();
        $text = ["Purchase Order - {$client->user->name}", 'Received via '.ucfirst($channel).' on '.now()->format('M j, Y'), '', ...$rows];

        return UploadedFile::fake()->createWithContent(sprintf('%s-order-%s.pdf', str($client->user->name)->slug(), now()->format('Ymd')), $this->pdf($text));
    }

    private function pdf(array $lines): string
    {
        $escape = fn (string $line) => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
        $content = "BT /F1 12 Tf 72 760 Td 16 TL\n".collect($lines)->map(fn (string $line) => '('.$escape($line).") Tj T*\n")->join('').'ET';
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($content)." >>\nstream\n{$content}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }

    private function defaultExpiry(string $sku): string
    {
        return $this->today->addDays(420 + (crc32($sku) % 300))->toDateString();
    }

    private function at(int $daysAgo, string $time = '09:00'): void
    {
        $this->moveTo($this->today->subDays($daysAgo)->setTimeFromTimeString($time));
    }

    private function moveTo(CarbonImmutable $moment): void
    {
        Carbon::setTestNow($moment);
        CarbonImmutable::setTestNow($moment);
    }

    private function backToNow(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
    }
}
