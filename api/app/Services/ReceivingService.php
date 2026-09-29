<?php

namespace App\Services;

use App\Events\StockLevelChanged;
use App\Models\Batch;
use App\Models\Employee;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDiscrepancy;
use App\Models\PurchaseOrderItem;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Owns the entire atomic receiving write path (Receiving Stock spec
 * Section 4), the match lookup, discrepancy logging, and the
 * session-completion logic that decides whether a PO can close.
 */
class ReceivingService
{
    private const RECEIVABLE_STATUSES = ['open', 'ready_for_delivery'];

    public function __construct(
        private readonly BatchAllocationService $batchAllocation,
        private readonly StockAvailabilityService $availability,
    ) {}

    /**
     * @return array{purchase_order: PurchaseOrder, lines: Collection<int, PurchaseOrderItem>, discrepancies: Collection<int, PurchaseOrderDiscrepancy>}
     */
    public function sessionView(PurchaseOrder $purchaseOrder): array
    {
        return [
            'purchase_order' => $purchaseOrder->load(['supplier', 'branch', 'preparedBy.user']),
            'lines' => $purchaseOrder->items()->with(['item.category', 'item.unit'])->get(),
            'discrepancies' => $purchaseOrder->discrepancies()->with(['item', 'purchaseOrderItem.item', 'resolvedBy.user'])->get(),
        ];
    }

    /**
     * @return array{status: string, item?: Item, purchase_order_item?: PurchaseOrderItem, remaining_quantity?: int}
     */
    public function match(PurchaseOrder $purchaseOrder, ?string $barcode, ?int $itemId): array
    {
        $this->assertReceivable($purchaseOrder);

        $item = $itemId ? Item::find($itemId) : Item::where('barcode', $barcode)->first();

        if (! $item) {
            throw ValidationException::withMessages([
                'barcode' => 'No item matches this barcode.',
            ]);
        }

        $line = PurchaseOrderItem::query()
            ->where('purchase_order_id', $purchaseOrder->id)
            ->where('item_id', $item->id)
            ->first();

        if (! $line) {
            return ['status' => 'not_found_on_po', 'item' => $item];
        }

        return [
            'status' => 'found_on_po',
            'purchase_order_item' => $line,
            'remaining_quantity' => max(0, $line->quantity_ordered - $line->quantity_received),
        ];
    }

    /**
     * @param  array{purchase_order_item_id: int, quantity_received: int, batch_number: string, mfg_date?: string, expiry_date?: string}  $data
     */
    public function confirm(PurchaseOrder $purchaseOrder, array $data, Employee $performedBy): PurchaseOrderItem
    {
        $this->assertReceivable($purchaseOrder);

        return DB::transaction(function () use ($purchaseOrder, $data, $performedBy) {
            $line = PurchaseOrderItem::query()
                ->where('purchase_order_id', $purchaseOrder->id)
                ->where('id', $data['purchase_order_item_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $item = Item::findOrFail($line->item_id);

            if ($item->has_expiry && empty($data['expiry_date'])) {
                throw ValidationException::withMessages([
                    'expiry_date' => 'Expiry date is required for this item.',
                ]);
            }

            $quantity = (int) $data['quantity_received'];
            $submittedExpiry = isset($data['expiry_date']) ? Carbon::parse($data['expiry_date'])->toDateString() : null;

            $batch = $this->batchAllocation->findExistingBatch($item->id, $purchaseOrder->branch_id, $data['batch_number']);

            if ($batch) {
                $existingExpiry = $batch->expiry_date?->toDateString();

                if ($existingExpiry !== $submittedExpiry) {
                    throw ValidationException::withMessages([
                        'expiry_date' => 'This batch number already exists with a different expiry date.',
                    ]);
                }

                $batch->increment('quantity', $quantity);
            } else {
                $batch = Batch::create([
                    'item_id' => $item->id,
                    'branch_id' => $purchaseOrder->branch_id,
                    'batch_number' => $data['batch_number'],
                    'mfg_date' => $data['mfg_date'] ?? null,
                    'quantity' => $quantity,
                    'expiry_date' => $submittedExpiry,
                    'received_date' => now()->toDateString(),
                ]);
            }

            $line->increment('quantity_received', $quantity);
            $line->refresh();

            StockTransaction::create([
                'item_id' => $item->id,
                'batch_id' => $batch->id,
                'branch_id' => $purchaseOrder->branch_id,
                'type' => 'receive',
                'quantity' => $quantity,
                'reference_type' => 'purchase_order',
                'reference_id' => $purchaseOrder->id,
                'performed_by' => $performedBy->id,
            ]);

            // Detectable the instant it happens — short discrepancies, by
            // contrast, can only be determined at session completion.
            if ($line->quantity_received > $line->quantity_ordered) {
                PurchaseOrderDiscrepancy::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'purchase_order_item_id' => $line->id,
                    'item_id' => $item->id,
                    'type' => 'over',
                    'scanned_quantity' => $line->quantity_received,
                ]);
            }

            $current = $this->availability->currentStock($item->id, $purchaseOrder->branch_id);
            $reserved = $this->availability->reservedStock($item->id, $purchaseOrder->branch_id);

            // Receiving only ever moves availability upward — never fire
            // LowStockThresholdCrossed from here, that event specifically
            // represents crossing at or below the reorder point.
            StockLevelChanged::dispatch($item->id, $purchaseOrder->branch_id, $current - $reserved, $reserved, $current);

            return $line;
        });
    }

    /**
     * @param  array{item_id?: int, purchase_order_item_id?: int, type: string, scanned_quantity?: int, notes?: string}  $data
     */
    public function logDiscrepancy(PurchaseOrder $purchaseOrder, array $data): PurchaseOrderDiscrepancy
    {
        $this->assertReceivable($purchaseOrder);

        return PurchaseOrderDiscrepancy::create([
            'purchase_order_id' => $purchaseOrder->id,
            'purchase_order_item_id' => $data['purchase_order_item_id'] ?? null,
            'item_id' => $data['item_id'] ?? null,
            'type' => $data['type'],
            'scanned_quantity' => $data['scanned_quantity'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);
    }

    /**
     * Closes only when every line's quantity_received exactly equals
     * quantity_ordered — a short OR an over line both fail that equality
     * and keep the PO open, with a `short` discrepancy upserted (not
     * duplicated on repeat calls) for whichever lines are still short.
     * `over` lines already got their discrepancy row the instant it
     * happened in confirm(), so nothing more to do for those here.
     */
    public function complete(PurchaseOrder $purchaseOrder): PurchaseOrder
    {
        $this->assertReceivable($purchaseOrder);

        return DB::transaction(function () use ($purchaseOrder) {
            $lines = $purchaseOrder->items()->lockForUpdate()->get();
            $allMatched = true;

            foreach ($lines as $line) {
                if ($line->quantity_received === $line->quantity_ordered) {
                    continue;
                }

                $allMatched = false;

                if ($line->quantity_received < $line->quantity_ordered) {
                    PurchaseOrderDiscrepancy::updateOrCreate(
                        [
                            'purchase_order_item_id' => $line->id,
                            'type' => 'short',
                            'resolved' => false,
                        ],
                        [
                            'purchase_order_id' => $purchaseOrder->id,
                            'item_id' => $line->item_id,
                            'scanned_quantity' => $line->quantity_received,
                        ],
                    );
                }
            }

            if ($allMatched) {
                $purchaseOrder->update(['status' => 'closed']);
            }

            return $purchaseOrder->fresh();
        });
    }

    public function resolveDiscrepancy(PurchaseOrderDiscrepancy $discrepancy, Employee $resolvedBy): PurchaseOrderDiscrepancy
    {
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

    private function assertReceivable(PurchaseOrder $purchaseOrder): void
    {
        if (! in_array($purchaseOrder->status, self::RECEIVABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => 'This purchase order is not open for receiving.',
            ]);
        }
    }
}
