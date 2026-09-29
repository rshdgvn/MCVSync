<?php

namespace App\Models;

use App\Models\Scopes\BranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
class PurchaseOrder extends Model
{
    use HasFactory;

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

    public function discrepancies(): HasMany
    {
        return $this->hasMany(PurchaseOrderDiscrepancy::class);
    }
}
