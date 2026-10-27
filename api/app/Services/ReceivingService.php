<?php

namespace App\Services;

use App\Contracts\ReceivableDocument;
use App\Models\Batch;
use App\Models\Discrepancy;
use App\Models\Employee;
use App\Models\Item;
use App\Models\StockTransaction;
use App\Services\Concerns\EnforcesActingBranch;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceivingService
{
    use EnforcesActingBranch;

    public function __construct(
        private readonly BatchAllocationService $batchAllocation,
        private readonly ScanMatchService $scanMatcher,
        private readonly DiscrepancyService $discrepancies,
        private readonly StockLevelNotifier $notifier,
    ) {}

    public function sessionView(ReceivableDocument $document): array
    {
        return [
            'lines' => $document->receivingLines()->with(['item.category', 'item.unit'])->get(),
            'discrepancies' => $this->discrepancies->forDocument($document),
        ];
    }

    public function match(ReceivableDocument $document, ?string $barcode, ?int $itemId, ?int $actingBranchId): array
    {
        $this->assertReceivable($document, $actingBranchId);

        $item = $this->scanMatcher->findItem($barcode, $itemId);
        $line = $this->scanMatcher->lineFor($document->receivingLines(), $item);

        if (! $line) {
            return ['status' => 'not_found', 'item' => $item];
        }

        return [
            'status' => 'found',
            'line' => $line,
            'remaining_quantity' => max(0, $line->expectedReceiptQuantity() - $line->quantity_received),
        ];
    }

    public function confirm(
        ReceivableDocument $document,
        int $lineId,
        array $data,
        Employee $performedBy,
        ?int $actingBranchId,
    ): Model {
        $this->assertReceivable($document, $actingBranchId);

        return DB::transaction(function () use ($document, $lineId, $data, $performedBy) {
            $branchId = $document->receivingBranchId();
            $line = $document->receivingLines()->whereKey($lineId)->lockForUpdate()->firstOrFail();
            $item = Item::findOrFail($line->item_id);
            $quantity = (int) $data['quantity_received'];

            $batch = $this->receiveIntoBatch($item, $branchId, $data, $quantity);

            $line->increment('quantity_received', $quantity);
            $line->refresh();

            StockTransaction::create([
                'item_id' => $item->id,
                'batch_id' => $batch->id,
                'branch_id' => $branchId,
                'type' => $document->receivingTransactionType(),
                'quantity' => $quantity,
                'reference_type' => $document->getMorphClass(),
                'reference_id' => $document->getKey(),
                'performed_by' => $performedBy->id,
            ]);

            if ($line->quantity_received > $line->expectedReceiptQuantity()) {
                $this->discrepancies->record($document, $line, $item->id, 'over', $line->quantity_received);
            }

            $this->notifier->changed($item->id, $branchId);

            return $line;
        });
    }

    public function logDiscrepancy(ReceivableDocument $document, array $data, ?int $actingBranchId): Discrepancy
    {
        $this->assertReceivable($document, $actingBranchId);

        $line = isset($data['line_id'])
            ? $document->receivingLines()->whereKey($data['line_id'])->firstOrFail()
            : null;

        return $this->discrepancies->record(
            $document,
            $line,
            $data['item_id'] ?? $line?->item_id,
            $data['type'],
            $data['scanned_quantity'] ?? null,
            $data['notes'] ?? null,
        );
    }

    public function complete(ReceivableDocument $document, ?int $actingBranchId): ReceivableDocument
    {
        $this->assertReceivable($document, $actingBranchId);

        return DB::transaction(function () use ($document) {
            $lines = $document->receivingLines()->lockForUpdate()->get();
            $allMatched = true;

            foreach ($lines as $line) {
                $expected = $line->expectedReceiptQuantity();

                if ($line->quantity_received === $expected) {
                    continue;
                }

                $allMatched = false;

                if ($line->quantity_received < $expected) {
                    $this->discrepancies->recordShortfall($document, $line);
                }
            }

            if ($allMatched) {
                $document->markFullyReceived();
            }

            return $document->fresh();
        });
    }

    private function receiveIntoBatch(Item $item, int $branchId, array $data, int $quantity): Batch
    {
        if ($item->has_expiry && empty($data['expiry_date'])) {
            throw ValidationException::withMessages([
                'expiry_date' => 'Expiry date is required for this item.',
            ]);
        }

        $submittedExpiry = isset($data['expiry_date']) ? Carbon::parse($data['expiry_date'])->toDateString() : null;
        $batch = $this->batchAllocation->findExistingBatch($item->id, $branchId, $data['batch_number']);

        if (! $batch) {
            return Batch::create([
                'item_id' => $item->id,
                'branch_id' => $branchId,
                'batch_number' => $data['batch_number'],
                'mfg_date' => $data['mfg_date'] ?? null,
                'quantity' => $quantity,
                'expiry_date' => $submittedExpiry,
                'received_date' => now()->toDateString(),
            ]);
        }

        if ($batch->expiry_date?->toDateString() !== $submittedExpiry) {
            throw ValidationException::withMessages([
                'expiry_date' => 'This batch number already exists with a different expiry date.',
            ]);
        }

        $batch->increment('quantity', $quantity);

        return $batch;
    }

    private function assertReceivable(ReceivableDocument $document, ?int $actingBranchId): void
    {
        if (! $document->isReceivable()) {
            throw ValidationException::withMessages([
                'status' => 'This document is not open for receiving.',
            ]);
        }

        $this->ensureActingBranch(
            $actingBranchId,
            $document->receivingBranchId(),
            'Only the receiving branch can receive against this document.',
        );
    }
}
