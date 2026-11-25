<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

#[Fillable(['key', 'user_id', 'fingerprint', 'response_status', 'response_body'])]
class IdempotencyKey extends Model
{
    use Prunable;

    public const RETENTION_DAYS = 7;

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(self::RETENTION_DAYS));
    }
}
