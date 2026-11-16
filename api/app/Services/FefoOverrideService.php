<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\FefoOverrideCode;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FefoOverrideService
{
    private const VALID_FOR_MINUTES = 15;

    private const CODE_LENGTH = 8;

    public function generate(Employee $generatedBy): FefoOverrideCode
    {
        return FefoOverrideCode::create([
            'code' => $this->uniqueCode(),
            'generated_by' => $generatedBy->id,
            'expires_at' => now()->addMinutes(self::VALID_FOR_MINUTES),
        ]);
    }

    public function redeem(string $code, Employee $usedBy): FefoOverrideCode
    {
        $override = FefoOverrideCode::query()
            ->where('code', Str::upper(trim($code)))
            ->lockForUpdate()
            ->first();

        $this->assertRedeemable($override);

        $override->update([
            'used' => true,
            'used_by' => $usedBy->id,
            'used_at' => now(),
        ]);

        return $override;
    }

    private function assertRedeemable(?FefoOverrideCode $override): void
    {
        $problem = match (true) {
            $override === null => 'This override code does not exist. Check the 8 characters and try again.',
            $override->used => 'This override code was already used. Ask the Super Admin for a new one.',
            ! $override->expires_at->isFuture() => 'This override code has expired. Ask the Super Admin for a new one.',
            default => null,
        };

        if ($problem !== null) {
            throw ValidationException::withMessages(['override_code' => $problem]);
        }
    }

    private function uniqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(self::CODE_LENGTH));
        } while (FefoOverrideCode::where('code', $code)->exists());

        return $code;
    }
}
