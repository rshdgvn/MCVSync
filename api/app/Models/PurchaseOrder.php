<?php

namespace App\Models;

use App\Contracts\ReceivableDocument;
use App\Models\Scopes\BranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'po_number',
    'supplier_id',
    'branch_id',
    'status',
    'order_date',
    'request_delivery_date',
    'terms',
    'prepared_by',
    'remarks',
    'source_type',
    'source_id',
])]
#[ScopedBy([BranchScope::class])]
class PurchaseOrder extends Model implements ReceivableDocument
{
    use HasFactory;

    private const RECEIVABLE_STATUSES = ['open', 'ready_for_delivery'];

    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'request_delivery_date' => 'date',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'prepared_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function discrepancies(): MorphMany
    {
        return $this->morphMany(Discrepancy::class, 'reference');
    }

    public function receivingBranchId(): int
    {
        return $this->branch_id;
    }

    public function isReceivable(): bool
    {
        return in_array($this->status, self::RECEIVABLE_STATUSES, true);
    }

    public function receivingTransactionType(): string
    {
        return 'receive';
    }

    public function receivingLines(): HasMany
    {
        return $this->items();
    }

    public function markFullyReceived(): void
    {
        $this->update(['status' => 'closed']);
    }

    public function involvesBranch(int $branchId): bool
    {
        return $this->branch_id === $branchId;
    }
}
