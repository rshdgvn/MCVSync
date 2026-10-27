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

        if (! $override?->isRedeemable()) {
            throw ValidationException::withMessages([
                'override_code' => 'This override code is invalid, expired, or already used.',
            ]);
        }

        $override->update([
            'used' => true,
            'used_by' => $usedBy->id,
            'used_at' => now(),
        ]);

        return $override;
    }

    private function uniqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(self::CODE_LENGTH));
        } while (FefoOverrideCode::where('code', $code)->exists());

        return $code;
    }
}
