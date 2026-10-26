<?php

namespace App\Models;

use App\Contracts\FulfillableDocument;
use App\Contracts\ReceivableDocument;
use App\Models\Scopes\TransferRequestBranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'transfer_number',
    'requesting_branch_id',
    'fulfilling_branch_id',
    'status',
    'requested_by',
    'shipped_at',
    'received_at',
    'remarks',
])]
#[ScopedBy([TransferRequestBranchScope::class])]
class TransferRequest extends Model implements FulfillableDocument, ReceivableDocument
{
    use HasFactory;

    protected $attributes = [
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'shipped_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function requestingBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'requesting_branch_id');
    }

    public function fulfillingBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'fulfilling_branch_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requested_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransferRequestItem::class);
    }

    public function discrepancies(): MorphMany
    {
        return $this->morphMany(Discrepancy::class, 'reference');
    }

    public function fulfillingBranchId(): int
    {
        return $this->fulfilling_branch_id;
    }

    public function isFulfillable(): bool
    {
        return $this->status === 'pending';
    }

    public function fulfillmentTransactionType(): string
    {
        return 'transfer_out';
    }

    public function fulfillmentLines(): HasMany
    {
        return $this->items();
    }

    public function receivingBranchId(): int
    {
        return $this->requesting_branch_id;
    }

    public function isReceivable(): bool
    {
        return $this->status === 'shipped';
    }

    public function receivingTransactionType(): string
    {
        return 'transfer_in';
    }

    public function receivingLines(): HasMany
    {
        return $this->items();
    }

    public function markFullyReceived(): void
    {
        $this->update(['status' => 'closed', 'received_at' => now()]);
    }

    public function involvesBranch(int $branchId): bool
    {
        return $this->requesting_branch_id === $branchId || $this->fulfilling_branch_id === $branchId;
    }
}
