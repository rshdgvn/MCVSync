<?php

namespace App\Services;

use App\Contracts\FulfillableDocument;
use App\Models\Batch;
use App\Models\Employee;
use App\Models\StockTransaction;
use App\Services\Concerns\EnforcesActingBranch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FulfillmentService
{
    use EnforcesActingBranch;

    public function __construct(
        private readonly BatchAllocationService $batchAllocation,
        private readonly ReservationService $reservations,
        private readonly StockAvailabilityService $availability,
        private readonly StockLevelNotifier $notifier,
        private readonly ScanMatchService $scanMatcher,
        private readonly FefoOverrideService $overrides,
        private readonly AuditLogger $audit,
    ) {}

    public function match(FulfillableDocument $document, ?string $barcode, ?int $itemId, ?int $actingBranchId): array
    {
        $this->assertFulfillable($document, $actingBranchId);

        DB::transaction(fn () => $this->lockAndReserve($document));

        $item = $this->scanMatcher->findItem($barcode, $itemId);
        $line = $this->scanMatcher->lineFor($document->fulfillmentLines(), $item);

        if (! $line) {
            return ['status' => 'not_found', 'item' => $item];
        }

        return [
            'status' => 'found',
            'line' => $line,
            'remaining_quantity' => max(0, $line->requestedQuantity() - $line->quantity_picked),
            'suggested_batch' => $this->batchAllocation->nextAvailableBatch($item->id, $document->fulfillingBranchId()),
        ];
    }

    public function pick(FulfillableDocument $document, array $data, Employee $picker, ?int $actingBranchId): Model
    {
        $this->assertFulfillable($document, $actingBranchId);

        return DB::transaction(function () use ($document, $data, $picker) {
            $this->lockAndReserve($document);

            $branchId = $document->fulfillingBranchId();
            $quantity = (int) $data['quantity'];
            $line = $this->lockLine($document, (int) $data['item_id'], $quantity);
            $batch = $this->selectBatch($document, $line, $data, $picker, $quantity);
            $availableBefore = $this->availability->available($line->item_id, $branchId);

            $batch->decrement('quantity', $quantity);

            StockTransaction::create([
                'item_id' => $line->item_id,
                'batch_id' => $batch->id,
                'branch_id' => $branchId,
                'type' => $document->fulfillmentTransactionType(),
                'quantity' => -$quantity,
                'reference_type' => $document->getMorphClass(),
                'reference_id' => $document->getKey(),
                'performed_by' => $picker->id,
            ]);

            $line->increment('quantity_picked', $quantity);

            $this->reservations->consume($document->getMorphClass(), $document->getKey(), $line->item_id, $branchId, $quantity);
            $this->notifier->decreased($line->item_id, $branchId, $availableBefore);

            return $line->refresh();
        });
    }

    private function assertFulfillable(FulfillableDocument $document, ?int $actingBranchId): void
    {
        if (! $document->isFulfillable()) {
            throw ValidationException::withMessages([
                'status' => 'This request is no longer open for fulfillment.',
            ]);
        }

        $this->ensureActingBranch(
            $actingBranchId,
            $document->fulfillingBranchId(),
            'Only the fulfilling branch can pick against this request.',
        );
    }

    private function lockAndReserve(FulfillableDocument $document): void
    {
        $document->newQueryWithoutScopes()
            ->whereKey($document->getKey())
            ->lockForUpdate()
            ->first();

        if ($this->reservations->hasReservationsFor($document->getMorphClass(), $document->getKey())) {
            return;
        }

        $document->fulfillmentLines()
            ->orderBy('id')
            ->get()
            ->each(function (Model $line) use ($document) {
                $outstanding = $line->requestedQuantity() - $line->quantity_picked;

                if ($outstanding > 0) {
                    $this->reservations->reserve(
                        $line->item_id,
                        $document->fulfillingBranchId(),
                        $outstanding,
                        $document->getMorphClass(),
                        $document->getKey(),
                    );
                }
            });
    }

    private function lockLine(FulfillableDocument $document, int $itemId, int $quantity): Model
    {
        $line = $document->fulfillmentLines()->where('item_id', $itemId)->lockForUpdate()->first();

        if (! $line) {
            throw ValidationException::withMessages([
                'item_id' => 'This item is not part of this request.',
            ]);
        }

        $remaining = $line->requestedQuantity() - $line->quantity_picked;

        if ($quantity > $remaining) {
            throw ValidationException::withMessages([
                'quantity' => "Only {$remaining} left to pick for this item.",
            ]);
        }

        return $line;
    }

    private function selectBatch(FulfillableDocument $document, Model $line, array $data, Employee $picker, int $quantity): Batch
    {
        $branchId = $document->fulfillingBranchId();
        $chosenBatchId = empty($data['batch_id']) ? null : (int) $data['batch_id'];

        $batch = $chosenBatchId === null
            ? $this->batchAllocation->lockNextAvailableBatch($line->item_id, $branchId)
            : $this->batchAllocation->lockBatchForPick($chosenBatchId, $line->item_id, $branchId);

        if (! $batch && $chosenBatchId === null) {
            throw ValidationException::withMessages([
                'quantity' => 'No stock left for this item at the fulfilling branch.',
            ]);
        }

        if (! $batch) {
            throw ValidationException::withMessages([
                'batch_id' => 'This batch is not available for this item at the fulfilling branch.',
            ]);
        }

        if ($batch->quantity < $quantity) {
            throw ValidationException::withMessages([
                'quantity' => "Batch {$batch->batch_number} only has {$batch->quantity} left. Pick those, then pick the rest from the next batch.",
            ]);
        }

        if ($chosenBatchId !== null && ! $this->batchAllocation->isFefoCompliant($batch)) {
            $this->authorizeOverride($document, $batch, $data, $picker, $quantity);
        }

        return $batch;
    }

    private function authorizeOverride(FulfillableDocument $document, Batch $batch, array $data, Employee $picker, int $quantity): void
    {
        if (empty($data['override_code']) || empty($data['override_reason'])) {
            throw ValidationException::withMessages([
                'override_code' => 'A batch with an earlier expiry exists. Picking this one needs a FEFO override code and a reason.',
            ]);
        }

        $override = $this->overrides->redeem($data['override_code'], $picker);

        $this->audit->record('fefo.override_used', $picker->user, 'staff', [
            'override_code_id' => $override->id,
            'reason' => $data['override_reason'],
            'reference_type' => $document->getMorphClass(),
            'reference_id' => $document->getKey(),
            'item_id' => $batch->item_id,
            'batch_id' => $batch->id,
            'batch_number' => $batch->batch_number,
            'quantity' => $quantity,
        ]);
    }
}
