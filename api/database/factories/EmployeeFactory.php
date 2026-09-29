<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employee>
 */
class EmployeeFactory extends Factory
{
    protected $model = Employee::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory()->staff(),
            'branch_id' => Branch::factory(),
            'position' => fake()->jobTitle(),
        ];
    }
}
