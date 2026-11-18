<?php

namespace App\Services;

use App\Contracts\ReceivableDocument;
use App\Models\Discrepancy;
use App\Models\Employee;
use App\Models\PurchaseOrder;
use App\Models\TransferRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DiscrepancyService
{
    public const RELATIONS = ['item', 'resolvedBy.user'];

    public const LIST_RELATIONS = ['item', 'resolvedBy.user', 'reference'];

    private const DOCUMENT_TYPES = [PurchaseOrder::class, TransferRequest::class];

    public function listQuery(array $filters): Builder
    {
        return $this->visibleDiscrepancies($filters)
            ->with(self::LIST_RELATIONS)
            ->when(isset($filters['resolved']), fn (Builder $query) => $query->where('resolved', $filters['resolved']))
            ->latest()
            ->orderByDesc('id');
    }

    public function resolutionCounts(array $filters): array
    {
        $totals = $this->visibleDiscrepancies($filters)
            ->toBase()
            ->selectRaw('resolved, COUNT(*) as total')
            ->groupBy('resolved')
            ->pluck('total', 'resolved');

        $resolved = (int) ($totals[1] ?? 0);
        $unresolved = (int) ($totals[0] ?? 0);

        return ['all' => $resolved + $unresolved, 'unresolved' => $unresolved, 'resolved' => $resolved];
    }

    public function record(
        ReceivableDocument $document,
        ?Model $line,
        ?int $itemId,
        string $type,
        ?int $scannedQuantity,
        ?string $notes = null,
        ?string $scannedBarcode = null,
    ): Discrepancy {
        return Discrepancy::create([
            'scanned_barcode' => $scannedBarcode,
            'reference_type' => $document->getMorphClass(),
            'reference_id' => $document->getKey(),
            'reference_item_type' => $line?->getMorphClass(),
            'reference_item_id' => $line?->getKey(),
            'item_id' => $itemId,
            'type' => $type,
            'scanned_quantity' => $scannedQuantity,
            'notes' => $notes,
        ]);
    }

    public function recordShortfall(ReceivableDocument $document, Model $line): Discrepancy
    {
        return Discrepancy::updateOrCreate(
            [
                'reference_item_type' => $line->getMorphClass(),
                'reference_item_id' => $line->getKey(),
                'type' => 'short',
                'resolved' => false,
            ],
            [
                'reference_type' => $document->getMorphClass(),
                'reference_id' => $document->getKey(),
                'item_id' => $line->item_id,
                'scanned_quantity' => $line->quantity_received,
            ],
        );
    }

    public function forDocument(ReceivableDocument $document): Collection
    {
        return $document->discrepancies()
            ->with(self::RELATIONS)
            ->latest()
            ->orderByDesc('id')
            ->get();
    }

    public function resolve(
        Discrepancy $discrepancy,
        Employee $resolvedBy,
        ?int $actingBranchId,
        string $resolution,
        ?string $note = null,
        ?int $linkedItemId = null,
    ): Discrepancy {
        $document = $this->documentWithinActingBranch($discrepancy, $actingBranchId);

        return DB::transaction(function () use ($discrepancy, $document, $resolvedBy, $resolution, $note, $linkedItemId) {
            $lockedDocument = $this->lockDocument($document);
            $locked = Discrepancy::query()->lockForUpdate()->findOrFail($discrepancy->id);

            if ($locked->resolved) {
                throw ValidationException::withMessages([
                    'resolved' => 'This discrepancy has already been resolved.',
                ]);
            }

            if ($linkedItemId !== null && $locked->item_id !== null) {
                throw ValidationException::withMessages([
                    'item_id' => 'This discrepancy is already linked to an item.',
                ]);
            }

            $locked->update([
                'item_id' => $linkedItemId ?? $locked->item_id,
                'resolved' => true,
                'resolved_by' => $resolvedBy->id,
                'resolved_at' => now(),
                'resolution' => $resolution,
                'resolution_note' => $note,
            ]);

            if ($resolution === 'accepted' && $locked->type === 'short') {
                $this->acceptShortfall($lockedDocument, $locked);
            }

            return $locked;
        });
    }

    public function lockDocument(ReceivableDocument $document): ReceivableDocument
    {
        return $document->newQueryWithoutScopes()->whereKey($document->getKey())->lockForUpdate()->firstOrFail();
    }

    private function acceptShortfall(ReceivableDocument $document, Discrepancy $discrepancy): void
    {
        if (! $document->isReceivable() || $discrepancy->reference_item_id === null) {
            return;
        }

        $line = $document->receivingLines()->whereKey($discrepancy->reference_item_id)->lockForUpdate()->firstOrFail();
        $line->increment('short_accepted_quantity', $line->unsettledQuantity());

        $document->closeIfSettled();
    }

    private function visibleDiscrepancies(array $filters): Builder
    {
        return Discrepancy::query()
            ->whereHasMorph('reference', self::DOCUMENT_TYPES)
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->when($filters['reference_type'] ?? null, fn (Builder $query, string $referenceType) => $query->where('reference_type', $referenceType))
            ->when($filters['reference_id'] ?? null, fn (Builder $query, int $referenceId) => $query->where('reference_id', $referenceId));
    }

    private function documentWithinActingBranch(Discrepancy $discrepancy, ?int $actingBranchId): ReceivableDocument
    {
        $document = $discrepancy->reference()->withoutGlobalScopes()->first();

        abort_unless($document instanceof ReceivableDocument, 404);
        abort_unless($actingBranchId === null || $document->involvesBranch($actingBranchId), 404);

        return $document;
    }
}
