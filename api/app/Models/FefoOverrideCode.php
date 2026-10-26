<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['code', 'generated_by', 'used', 'used_by', 'used_at', 'expires_at'])]
class FefoOverrideCode extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $attributes = [
        'used' => false,
    ];

    protected function casts(): array
    {
        return [
            'used' => 'boolean',
            'used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'generated_by');
    }

    public function usedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'used_by');
    }

    public function isRedeemable(): bool
    {
        return ! $this->used && $this->expires_at->isFuture();
    }
}
