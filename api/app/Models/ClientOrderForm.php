<?php

namespace App\Models;

use App\Contracts\DiscrepancyDocument;
use App\Contracts\FulfillableDocument;
use App\Models\Scopes\BranchScope;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'cof_number',
    'dr_number',
    'client_id',
    'branch_id',
    'source_type',
    'source_id',
    'order_status',
    'cancellation_requested',
    'prepared_by',
    'checked_by',
    'terms',
    'request_delivery_date',
    'remarks',
    'revision_reason',
    'dispatch_hold_note',
    'dispatch_held_by',
    'dispatch_held_at',
    'issue_description',
    'issue_reported_at',
])]
#[ScopedBy([BranchScope::class])]
class ClientOrderForm extends Model implements DiscrepancyDocument, FulfillableDocument
{
    public const STATUSES = ['pending_approval', 'needs_revision', 'processing', 'ready_for_delivery', 'delivered', 'completed', 'cancelled'];

    protected $attributes = [
        'order_status' => 'pending_approval',
        'cancellation_requested' => false,
    ];

    protected function casts(): array
    {
        return [
            'cancellation_requested' => 'boolean',
            'request_delivery_date' => 'date',
            'dispatch_held_at' => 'datetime',
            'issue_reported_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'prepared_by');
    }

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'checked_by');
    }

    public function dispatchHeldBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'dispatch_held_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ClientOrderFormItem::class);
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(ClientSubmission::class, 'source_id');
    }

    public function incomingMessage(): BelongsTo
    {
        return $this->belongsTo(IncomingClientMessage::class, 'source_id');
    }

    public function discrepancies(): MorphMany
    {
        return $this->morphMany(Discrepancy::class, 'reference');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'reference');
    }

    public function fulfillingBranchId(): int
    {
        return $this->branch_id;
    }

    public function isFulfillable(): bool
    {
        return $this->order_status === 'processing';
    }

    public function fulfillmentTransactionType(): string
    {
        return 'issue';
    }

    public function fulfillmentLines(): HasMany
    {
        return $this->items();
    }

    public function involvesBranch(int $branchId): bool
    {
        return $this->branch_id === $branchId;
    }

    public function documentNumber(): string
    {
        return $this->cof_number;
    }

    public function deliveryDate(): ?CarbonImmutable
    {
        return null;
    }

    public function isFromPortal(): bool
    {
        return $this->source_type === 'portal';
    }

    public function orderTotal(): float
    {
        return (float) $this->items->sum(fn (ClientOrderFormItem $line) => (float) $line->total);
    }
}
