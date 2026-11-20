<?php

namespace App\Models;

use App\Models\Scopes\BranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'client_id',
    'branch_id',
    'channel',
    'attachment_path',
    'attachment_name',
    'received_at',
    'status',
    'converted_cof_id',
    'logged_by',
])]
#[ScopedBy([BranchScope::class])]
class IncomingClientMessage extends Model
{
    public const CHANNELS = ['messenger', 'viber', 'email'];

    protected $attributes = [
        'status' => 'received',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function loggedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'logged_by');
    }

    public function convertedCof(): BelongsTo
    {
        return $this->belongsTo(ClientOrderForm::class, 'converted_cof_id');
    }
}
