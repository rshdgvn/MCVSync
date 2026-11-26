<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\ClientOrderForm;
use App\Models\ClientOrderFormItem;
use App\Models\ClientSubmission;
use App\Models\Discrepancy;
use App\Models\Employee;
use App\Models\IncomingClientMessage;
use App\Models\Payment;
use App\Services\Concerns\EnforcesActingBranch;
use App\Support\PaymentTerms;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClientOrderFormService
{
    use EnforcesActingBranch;

    public const DETAIL_RELATIONS = [
        'client.user',
        'client.zone',
        'branch',
        'preparedBy.user',
        'checkedBy.user',
        'dispatchHeldBy.user',
        'items.item.unit',
        'items.item.category',
        'delivery',
    ];

    private const EDITABLE_STATUSES = ['pending_approval'];

    private const INSTANT_CANCEL_STATUSES = ['pending_approval', 'needs_revision'];

    private const CANCELLATION_REQUEST_STATUSES = ['processing', 'ready_for_delivery'];

    public function __construct(
        private readonly DocumentNumberGenerator $numbers,
        private readonly DiscountService $discounts,
        private readonly PricingService $pricing,
        private readonly ReservationService $reservations,
        private readonly FulfillmentService $fulfillment,
        private readonly DiscrepancyService $discrepancies,
        private readonly PurchaseOrderService $purchaseOrders,
        private readonly PaymentService $payments,
    ) {}

    /**
     * @param  array{search?: string, status?: string, client_id?: int, cancellation_requested?: bool}  $filters
     */
    public function listQuery(array $filters): Builder
    {
        return $this->filtered($filters)
            ->with(['client.user', 'branch'])
            ->withCount('items')
            ->withSum('items', 'total')
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('order_status', $status))
            ->latest()
            ->orderByDesc('id');
    }

    /**
     * @param  array{search?: string, client_id?: int, cancellation_requested?: bool}  $filters
     * @return array<string, int>
     */
    public function statusCounts(array $filters): array
    {
        $totals = $this->filtered($filters)
            ->toBase()
            ->selectRaw('order_status, COUNT(*) as total')
            ->groupBy('order_status')
            ->pluck('total', 'order_status');

        $counts = ['all' => (int) $totals->sum()];
        foreach (ClientOrderForm::STATUSES as $status) {
            $counts[$status] = (int) ($totals[$status] ?? 0);
        }

        return $counts;
    }

    public function fulfillmentQueue(): Builder
    {
        return ClientOrderForm::query()
            ->where('order_status', 'processing')
            ->whereNull('picking_completed_at')
            ->with(['client.user', 'branch'])
            ->withCount('items')
            ->orderByRaw('request_delivery_date is null')
            ->orderBy('request_delivery_date')
            ->orderBy('forwarded_at')
            ->orderBy('id');
    }

    public function dispatchQueue(): Builder
    {
        return ClientOrderForm::query()
            ->where('order_status', 'processing')
            ->whereHas('discrepancies', fn (Builder $query) => $query->where('resolved', false))
            ->with(['client.user', 'branch', 'dispatchHeldBy.user'])
            ->withCount(['discrepancies as open_discrepancies_count' => fn (Builder $query) => $query->where('resolved', false)])
            ->oldest()
            ->orderBy('id');
    }

    /**
     * @param  array<int, array{item_id: int, quantity: int, discount_percent?: ?float}>  $lines
     */
    public function createManual(array $data, array $lines, Employee $preparedBy): ClientOrderForm
    {
        return DB::transaction(function () use ($data, $lines, $preparedBy) {
            $message = IncomingClientMessage::query()->lockForUpdate()->findOrFail($data['incoming_message_id']);

            if ($message->status !== 'received' || blank($message->attachment_path)) {
                throw ValidationException::withMessages([
                    'incoming_message_id' => 'Choose a received message with its attachment that has not been converted yet.',
                ]);
            }

            if ($message->client_id !== (int) $data['client_id']) {
                throw ValidationException::withMessages([
                    'incoming_message_id' => 'This message came from a different client.',
                ]);
            }

            $cof = $this->createCof([
                'client_id' => $message->client_id,
                'branch_id' => $preparedBy->branch_id ?? $message->branch_id,
                'source_type' => 'manual',
                'source_id' => $message->id,
                'prepared_by' => $preparedBy->id,
                'terms' => $data['terms'] ?? null,
                'request_delivery_date' => $data['request_delivery_date'] ?? null,
                'remarks' => $data['remarks'] ?? null,
            ], $lines);

            $message->update(['status' => 'converted', 'converted_cof_id' => $cof->id]);

            return $cof;
        });
    }

    public function createFromSubmission(ClientSubmission $submission): ClientOrderForm
    {
        $client = $submission->client;
        $lines = $submission->items->map(fn ($line) => ['item_id' => $line->item_id, 'quantity' => $line->quantity])->all();

        $cof = $this->createCof([
            'client_id' => $client->id,
            'branch_id' => $client->branch_id ?? Branch::where('is_main', true)->value('id'),
            'source_type' => 'portal',
            'source_id' => $submission->id,
            'remarks' => $submission->notes,
        ], $lines);

        $submission->update(['converted_cof_id' => $cof->id]);

        return $cof;
    }

    /**
     * @param  array<int, array{item_id: int, quantity: int, discount_percent?: ?float, differs_from_request_reason?: ?string}>|null  $lines
     */
    public function update(ClientOrderForm $cof, array $data, ?array $lines): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $data, $lines) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, self::EDITABLE_STATUSES, 'Only an order pending approval can be edited.');

            $locked->update($data);

            if ($lines !== null) {
                $this->replaceLines($locked, $lines, $this->requestedQuantities($locked));
            }

            return $locked;
        });
    }

    public function sendForRevision(ClientOrderForm $cof, string $reason): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $reason) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['pending_approval'], 'Only an order pending approval can be sent back for revision.');

            if (! $locked->isFromPortal()) {
                throw ValidationException::withMessages([
                    'status' => 'Only portal orders can be sent back to the client. Edit a manual order directly.',
                ]);
            }

            $locked->update(['order_status' => 'needs_revision', 'revision_reason' => $reason]);

            return $locked;
        });
    }

    /**
     * @param  array<int, array{item_id: int, quantity: int}>  $lines
     */
    public function resubmit(ClientOrderForm $cof, array $lines, ?string $notes): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $lines, $notes) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['needs_revision'], 'Only an order that needs revision can be resubmitted.');

            $submission = ClientSubmission::query()->lockForUpdate()->findOrFail($locked->source_id);
            $submission->items()->delete();
            foreach ($lines as $line) {
                $submission->items()->create(['item_id' => $line['item_id'], 'quantity' => $line['quantity']]);
            }
            $submission->update(['notes' => $notes, 'submitted_at' => now()]);

            $locked->items()->delete();
            $this->createLines($locked, $lines);
            $locked->update(['order_status' => 'pending_approval', 'revision_reason' => null, 'remarks' => $notes]);

            return $locked;
        });
    }

    public function forward(ClientOrderForm $cof, Employee $forwardedBy): ClientOrderForm
    {
        return $this->purchaseOrders->draftingShortages(function () use ($cof, $forwardedBy) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['pending_approval'], 'Only an order pending approval can be forwarded to Purchasing.');

            $lines = $locked->items()->orderBy('id')->lockForUpdate()->get();
            $prices = $this->pricing->currentPricesFor($locked->client_id, $lines->pluck('item_id')->all());
            $unpriced = $lines->reject(fn (ClientOrderFormItem $line) => isset($prices[$line->item_id]));

            if ($unpriced->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Accounting has not priced every item for this client yet: '.$unpriced->load('item')->pluck('item.name')->join(', ').'.',
                ]);
            }

            foreach ($lines as $line) {
                $unitCost = $prices[$line->item_id];
                $line->update(['unit_cost' => $unitCost, 'total' => $line->lineTotal($line->quantity, $unitCost)]);

                $this->reservations->reserve(
                    $line->item_id,
                    $locked->branch_id,
                    $line->quantity,
                    $locked->getMorphClass(),
                    $locked->id,
                );
            }

            $locked->update([
                'order_status' => 'processing',
                'prepared_by' => $locked->prepared_by ?? $forwardedBy->id,
                'forwarded_at' => now(),
            ]);

            return $locked;
        });
    }

    public function pick(ClientOrderForm $cof, array $data, Employee $picker, ?int $actingBranchId): ClientOrderFormItem
    {
        return DB::transaction(function () use ($cof, $data, $picker, $actingBranchId) {
            $this->assertOpenForPicking($this->lock($cof));
            $line = $this->fulfillment->pick($cof, $data, $picker, $actingBranchId);

            $this->markReadyIfFullyPicked($this->lock($cof));

            return $line;
        });
    }

    public function completePicking(ClientOrderForm $cof, ?int $actingBranchId): ClientOrderForm
    {
        $this->ensureActingBranch($actingBranchId, $cof->branch_id, 'Only the branch fulfilling this order can complete its picking.');

        return DB::transaction(function () use ($cof) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['processing'], 'Only an order being processed can complete picking.');
            $this->assertOpenForPicking($locked);

            $shortLines = $locked->items()->whereColumn('quantity_picked', '<', 'quantity')->lockForUpdate()->get();

            if ($shortLines->isEmpty()) {
                $this->markReady($locked);

                return $locked;
            }

            $shortLines->each(fn (ClientOrderFormItem $line) => $this->discrepancies->recordShortfall($locked, $line, $line->quantity_picked));
            $locked->update(['picking_completed_at' => now()]);

            return $locked;
        });
    }

    public function assertOpenForPicking(ClientOrderForm $cof): void
    {
        if ($cof->cancellation_requested) {
            throw ValidationException::withMessages([
                'cancellation_requested' => 'The client asked to cancel this order. Picking is paused until Sales or Purchasing confirms or declines the request.',
            ]);
        }

        if ($cof->picking_completed_at !== null) {
            throw ValidationException::withMessages([
                'status' => 'Picking is already complete for this order. Sales decides whether to dispatch what was picked.',
            ]);
        }
    }

    public function approveDispatch(ClientOrderForm $cof, Employee $checkedBy, ?string $note): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $checkedBy, $note) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['processing'], 'Only an order being processed can be approved for dispatch.');

            $open = $this->openDiscrepancies($locked);

            if ($open->isEmpty()) {
                throw ValidationException::withMessages([
                    'status' => 'This order has no open discrepancy to approve.',
                ]);
            }

            $lines = $locked->items()->lockForUpdate()->get();

            if ($lines->sum('quantity_picked') === 0) {
                throw ValidationException::withMessages([
                    'status' => 'Nothing has been picked for this order, so there is nothing to dispatch. Cancel it or wait for stock.',
                ]);
            }

            $open->each(fn (Discrepancy $discrepancy) => $this->discrepancies->resolve($discrepancy, $checkedBy, null, 'accepted', $note));
            $this->reservations->releaseAllFor($locked->getMorphClass(), $locked->id);

            $lines->each(fn (ClientOrderFormItem $line) => $line->update([
                'total' => $line->lineTotal($line->quantity_picked, (float) $line->unit_cost),
            ]));

            $locked->update(['checked_by' => $checkedBy->id]);
            $this->markReady($locked);

            return $locked;
        });
    }

    public function holdDispatch(ClientOrderForm $cof, Employee $heldBy, string $note): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $heldBy, $note) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['processing'], 'Only an order being processed can be held.');

            if ($this->openDiscrepancies($locked)->isEmpty()) {
                throw ValidationException::withMessages([
                    'status' => 'This order has no open discrepancy to hold.',
                ]);
            }

            $locked->update([
                'dispatch_hold_note' => $note,
                'dispatch_held_by' => $heldBy->id,
                'dispatch_held_at' => now(),
            ]);

            return $locked;
        });
    }

    public function cancel(ClientOrderForm $cof): ClientOrderForm
    {
        return DB::transaction(function () use ($cof) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, self::INSTANT_CANCEL_STATUSES, 'Only an order pending approval or needing revision can be cancelled right away. Request a cancellation instead.');

            $locked->update(['order_status' => 'cancelled']);

            return $locked;
        });
    }

    public function requestCancellation(ClientOrderForm $cof): ClientOrderForm
    {
        return DB::transaction(function () use ($cof) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, self::CANCELLATION_REQUEST_STATUSES, 'A cancellation can only be requested while the order is being processed or ready for delivery.');

            if ($locked->cancellation_requested) {
                throw ValidationException::withMessages([
                    'cancellation_requested' => 'A cancellation has already been requested for this order.',
                ]);
            }

            $locked->update(['cancellation_requested' => true]);

            return $locked;
        });
    }

    public function confirmCancellation(ClientOrderForm $cof, Employee $confirmedBy): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $confirmedBy) {
            $locked = $this->lockRequestedCancellation($cof);

            $this->reservations->releaseAllFor($locked->getMorphClass(), $locked->id);
            $this->fulfillment->returnPicks($locked, $confirmedBy);

            $locked->update([
                'order_status' => 'cancelled',
                'cancellation_requested' => false,
                'dr_number' => null,
            ]);

            return $locked;
        });
    }

    public function declineCancellation(ClientOrderForm $cof): ClientOrderForm
    {
        return DB::transaction(function () use ($cof) {
            $locked = $this->lockRequestedCancellation($cof);
            $locked->update(['cancellation_requested' => false]);

            return $locked;
        });
    }

    public function markDelivered(ClientOrderForm $cof): ClientOrderForm
    {
        return DB::transaction(function () use ($cof) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['ready_for_delivery'], 'Only an order that is ready for delivery can be confirmed delivered.');

            if ($locked->cancellation_requested) {
                throw ValidationException::withMessages([
                    'cancellation_requested' => 'The client asked to cancel this order. Sales or Purchasing must resolve the request before it can be delivered.',
                ]);
            }

            $locked->update(['order_status' => 'delivered']);

            return $locked;
        });
    }

    public function confirmReceipt(ClientOrderForm $cof): ClientOrderForm
    {
        return DB::transaction(function () use ($cof) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['delivered'], 'Only a delivered order can be confirmed as received.');

            $locked->update(['order_status' => 'completed']);

            $this->payments->createForOrder(
                $locked->getMorphClass(),
                $locked->id,
                $locked->load('items')->orderTotal(),
                PaymentTerms::label($locked->terms),
                PaymentTerms::dueDate($locked->terms, $locked->deliveryDate()),
            );

            return $locked;
        });
    }

    public function reportIssue(ClientOrderForm $cof, string $description): ClientOrderForm
    {
        return DB::transaction(function () use ($cof, $description) {
            $locked = $this->lock($cof);
            $this->assertStatus($locked, ['delivered'], 'An issue can only be reported on a delivered order.');

            $locked->update(['issue_description' => $description, 'issue_reported_at' => now()]);

            return $locked;
        });
    }

    public function paymentFor(ClientOrderForm $cof): ?Payment
    {
        return $cof->payments()->latest('id')->first();
    }

    public function needsPricing(ClientOrderForm $cof): Collection
    {
        $itemIds = $cof->items->pluck('item_id')->all();
        $prices = $this->pricing->currentPricesFor($cof->client_id, $itemIds);

        return collect($itemIds)->reject(fn (int $itemId) => isset($prices[$itemId]))->values();
    }

    /**
     * @return array<int, float>
     */
    public function suggestedPrices(ClientOrderForm $cof): array
    {
        return $this->pricing->currentPricesFor($cof->client_id, $cof->items->pluck('item_id')->all());
    }

    private function createCof(array $attributes, array $lines): ClientOrderForm
    {
        $cof = ClientOrderForm::create([
            ...$attributes,
            'cof_number' => $this->numbers->next(ClientOrderForm::class, 'cof_number', 'COF'),
            'order_status' => 'pending_approval',
        ]);

        $this->createLines($cof, $lines);

        return $cof;
    }

    private function createLines(ClientOrderForm $cof, array $lines, array $requested = []): void
    {
        $standing = $this->discounts->currentDiscountsFor($cof->client_id, array_column($lines, 'item_id'));

        foreach ($lines as $index => $line) {
            $differs = $requested !== [] && ($requested[$line['item_id']] ?? null) !== (int) $line['quantity'];

            if ($differs && blank($line['differs_from_request_reason'] ?? null)) {
                throw ValidationException::withMessages([
                    "items.{$index}.differs_from_request_reason" => 'Say why this quantity differs from what the client requested.',
                ]);
            }

            $cof->items()->create([
                'item_id' => $line['item_id'],
                'quantity' => $line['quantity'],
                'discount_percent' => $line['discount_percent'] ?? $standing[$line['item_id']] ?? 0,
                'differs_from_request' => $differs,
                'differs_from_request_reason' => $differs ? $line['differs_from_request_reason'] : null,
            ]);
        }
    }

    private function replaceLines(ClientOrderForm $cof, array $lines, array $requested): void
    {
        $cof->items()->delete();
        $this->createLines($cof, $lines, $requested);
    }

    /**
     * @return array<int, int>
     */
    private function requestedQuantities(ClientOrderForm $cof): array
    {
        if (! $cof->isFromPortal()) {
            return [];
        }

        return ClientSubmission::query()
            ->findOrFail($cof->source_id)
            ->items()
            ->pluck('quantity', 'item_id')
            ->map(fn ($quantity) => (int) $quantity)
            ->all();
    }

    private function markReadyIfFullyPicked(ClientOrderForm $cof): void
    {
        $fullyPicked = ! $cof->items()->whereColumn('quantity_picked', '<', 'quantity')->exists();

        if ($fullyPicked) {
            $this->markReady($cof);
        }
    }

    private function markReady(ClientOrderForm $cof): void
    {
        $cof->update([
            'order_status' => 'ready_for_delivery',
            'ready_for_delivery_at' => now(),
            'picking_completed_at' => $cof->picking_completed_at ?? now(),
            'dr_number' => $cof->dr_number ?? $this->numbers->next(ClientOrderForm::class, 'dr_number', 'DR'),
            'dispatch_hold_note' => null,
            'dispatch_held_by' => null,
            'dispatch_held_at' => null,
        ]);
    }

    private function openDiscrepancies(ClientOrderForm $cof): Collection
    {
        return $cof->discrepancies()->where('resolved', false)->orderBy('id')->get();
    }

    private function lockRequestedCancellation(ClientOrderForm $cof): ClientOrderForm
    {
        $locked = $this->lock($cof);

        if (! $locked->cancellation_requested) {
            throw ValidationException::withMessages([
                'cancellation_requested' => 'There is no cancellation request on this order.',
            ]);
        }

        return $locked;
    }

    private function assertStatus(ClientOrderForm $cof, array $allowed, string $message): void
    {
        if (! in_array($cof->order_status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }

    private function lock(ClientOrderForm $cof): ClientOrderForm
    {
        return ClientOrderForm::query()->withoutGlobalScopes()->lockForUpdate()->findOrFail($cof->id);
    }

    private function filtered(array $filters): Builder
    {
        return ClientOrderForm::query()
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $pattern = '%'.$search.'%';
                $query->where(fn (Builder $inner) => $inner
                    ->whereLike('cof_number', $pattern)
                    ->orWhereHas('client.user', fn (Builder $user) => $user->whereLike('name', $pattern)));
            })
            ->when($filters['client_id'] ?? null, fn (Builder $query, int $clientId) => $query->where('client_id', $clientId))
            ->when($filters['source_type'] ?? null, fn (Builder $query, string $source) => $query->where('source_type', $source))
            ->when(isset($filters['cancellation_requested']), fn (Builder $query) => $query->where('cancellation_requested', $filters['cancellation_requested']));
    }
}
