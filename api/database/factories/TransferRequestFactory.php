<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\TransferRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

class TransferRequestFactory extends Factory
{
    protected $model = TransferRequest::class;

    public function definition(): array
    {
        return [
            'transfer_number' => 'TR-'.fake()->unique()->numerify('####'),
            'requesting_branch_id' => Branch::factory(),
            'fulfilling_branch_id' => Branch::factory()->state(['is_main' => true]),
            'status' => 'pending',
            'requested_by' => Employee::factory(),
            'remarks' => null,
        ];
    }
}
