<?php

namespace App\Services;

use App\Contracts\ReceivableDocument;
use App\Models\Discrepancy;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class DiscrepancyService
{
    public const RELATIONS = ['item', 'resolvedBy.user'];

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

    public function resolve(Discrepancy $discrepancy, Employee $resolvedBy, ?int $actingBranchId): Discrepancy
    {
        $this->ensureWithinActingBranch($discrepancy, $actingBranchId);

        if ($discrepancy->resolved) {
            throw ValidationException::withMessages([
                'resolved' => 'This discrepancy has already been resolved.',
            ]);
        }

        $discrepancy->update([
            'resolved' => true,
            'resolved_by' => $resolvedBy->id,
            'resolved_at' => now(),
        ]);

        return $discrepancy;
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
