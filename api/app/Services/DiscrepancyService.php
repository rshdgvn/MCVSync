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
    ): Discrepancy {
        return Discrepancy::create([
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

    public function resolve(Discrepancy $discrepancy, Employee $resolvedBy, ?int $actingBranchId, ?string $note = null): Discrepancy
    {
        $this->ensureWithinActingBranch($discrepancy, $actingBranchId);

        return DB::transaction(function () use ($discrepancy, $resolvedBy, $note) {
            $locked = Discrepancy::query()->lockForUpdate()->findOrFail($discrepancy->id);

            if ($locked->resolved) {
                throw ValidationException::withMessages([
                    'resolved' => 'This discrepancy has already been resolved.',
                ]);
            }

            $locked->update([
                'resolved' => true,
                'resolved_by' => $resolvedBy->id,
                'resolved_at' => now(),
                'resolution_note' => $note,
            ]);

            return $locked;
        });
    }

    private function visibleDiscrepancies(array $filters): Builder
    {
        return Discrepancy::query()
            ->whereHasMorph('reference', self::DOCUMENT_TYPES)
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->when($filters['reference_type'] ?? null, fn (Builder $query, string $referenceType) => $query->where('reference_type', $referenceType))
            ->when($filters['reference_id'] ?? null, fn (Builder $query, int $referenceId) => $query->where('reference_id', $referenceId));
    }

    private function ensureWithinActingBranch(Discrepancy $discrepancy, ?int $actingBranchId): void
    {
        if ($actingBranchId === null) {
            return;
        }

        $document = $discrepancy->reference()->withoutGlobalScopes()->first();

        abort_unless($document instanceof ReceivableDocument && $document->involvesBranch($actingBranchId), 404);
    }
}
