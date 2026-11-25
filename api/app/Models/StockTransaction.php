<?php

namespace App\Models;

use App\Models\Scopes\BranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only. No update or delete path should exist for this model at the
 * application layer, regardless of role — this is the inventory module's
 * own audit trail. `UPDATED_AT` is disabled since a row is never touched
 * again after it's written.
 */
#[Fillable(['item_id', 'batch_id', 'branch_id', 'type', 'quantity', 'reference_type', 'reference_id', 'performed_by'])]
#[ScopedBy([BranchScope::class])]
class StockTransaction extends Model
{
    use HasFactory;

    public const CANCEL_RETURN = 'cancel_return';

    const UPDATED_AT = null;

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'performed_by');
    }
}
