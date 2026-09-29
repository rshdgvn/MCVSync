<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory
{
    protected $model = PurchaseOrder::class;

    public function definition(): array
    {
        return [
            'po_number' => 'PO-'.fake()->unique()->numerify('####'),
            'supplier_id' => Supplier::factory(),
            'branch_id' => Branch::factory(),
            'status' => 'open',
            'order_date' => now()->toDateString(),
            'request_delivery_date' => null,
            'terms' => null,
            'prepared_by' => Employee::factory(),
            'remarks' => null,
        ];
    }
}
