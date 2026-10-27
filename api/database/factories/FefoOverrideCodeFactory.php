<?php

namespace Database\Factories;

use App\Models\Employee;
use App\Models\FefoOverrideCode;
use Illuminate\Database\Eloquent\Factories\Factory;

class FefoOverrideCodeFactory extends Factory
{
    protected $model = FefoOverrideCode::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('????####')),
            'generated_by' => Employee::factory(),
            'used' => false,
            'expires_at' => now()->addMinutes(15),
        ];
    }
}
