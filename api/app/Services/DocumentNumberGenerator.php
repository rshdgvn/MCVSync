<?php

namespace App\Services;

use Illuminate\Support\Str;

class DocumentNumberGenerator
{
    private const SEQUENCE_PAD_LENGTH = 4;

    public function next(string $modelClass, string $column, string $prefix): string
    {
        $lastNumber = $modelClass::query()
            ->withoutGlobalScopes()
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value($column);

        $nextSequence = $lastNumber ? ((int) Str::after($lastNumber, "{$prefix}-")) + 1 : 1;

        return $prefix.'-'.str_pad((string) $nextSequence, self::SEQUENCE_PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
