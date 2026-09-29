<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Scopes\BranchScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Owns PO creation (including po_number generation), status transition
 * rules, and line-item total computation — the real business logic this
 * module has, per the Purchase Orders to Suppliers spec Section 5.
 */
class PurchaseOrderService
{
    private const LINES_EDITABLE_STATUSES = ['draft', 'open'];

    private const CANCELLABLE_STATUSES = ['draft', 'open', 'ready_for_delivery'];

    /**
     * @param  array<int, array{item_id: int, quantity_ordered: int, unit_cost: float, discount?: float}>  $items
     */
    public function create(array $data, array $items, Employee $preparedBy): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items, $preparedBy) {
            $purchaseOrder = PurchaseOrder::create([
                ...$data,
                'po_number' => $this->generatePoNumber(),
                'status' => 'open',
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'prepared_by' => $preparedBy->id,
            ]);

            foreach ($items as $line) {
                $this->createLine($purchaseOrder, $line);
            }

            return $purchaseOrder;
        });
    }

    public function updateHeader(PurchaseOrder $purchaseOrder, array $data): PurchaseOrder
    {
        $this->assertLinesEditable($purchaseOrder);

        $purchaseOrder->update($data);

        return $purchaseOrder;
    }

    /**
     * @param  array{item_id: int, quantity_ordered: int, unit_cost: float, discount?: float}  $data
     */
    public function addItem(PurchaseOrder $purchaseOrder, array $data): PurchaseOrderItem
    {
        $this->assertLinesEditable($purchaseOrder);

        return $this->createLine($purchaseOrder, $data);
    }

    /**
     * @param  array{quantity_ordered: int, unit_cost: float, discount?: float}  $data
     */
    public function updateItem(PurchaseOrderItem $item, array $data): PurchaseOrderItem
    {
        $this->assertLinesEditable($item->purchaseOrder);

        $quantity = $data['quantity_ordered'];
        $unitCost = $data['unit_cost'];
        $discount = $data['discount'] ?? 0;

        $item->update([
            'quantity_ordered' => $quantity,
            'unit_cost' => $unitCost,
            'discount' => $discount,
            'total' => ($quantity * $unitCost) - $discount,
        ]);

        return $item;
    }

    public function removeItem(PurchaseOrderItem $item): void
    {
        $this->assertLinesEditable($item->purchaseOrder);

        $item->delete();
    }

    public function markReady(PurchaseOrder $purchaseOrder): PurchaseOrder
    {
        if ($purchaseOrder->status !== 'open') {
            throw ValidationException::withMessages([
                'status' => 'Only an open purchase order can be marked ready for delivery.',
            ]);
        }

        $purchaseOrder->update(['status' => 'ready_for_delivery']);

        return $purchaseOrder;
    }

    public function cancel(PurchaseOrder $purchaseOrder): PurchaseOrder
    {
        if (! in_array($purchaseOrder->status, self::CANCELLABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => 'This purchase order can no longer be cancelled.',
            ]);
        }

        $purchaseOrder->update(['status' => 'cancelled']);

        return $purchaseOrder;
    }

    /**
     * @param  array{item_id: int, quantity_ordered: int, unit_cost: float, discount?: float}  $data
     */
    private function createLine(PurchaseOrder $purchaseOrder, array $data): PurchaseOrderItem
    {
        $quantity = $data['quantity_ordered'];
        $unitCost = $data['unit_cost'];
        $discount = $data['discount'] ?? 0;

        return $purchaseOrder->items()->create([
            'item_id' => $data['item_id'],
            'quantity_ordered' => $quantity,
            'unit_cost' => $unitCost,
            'discount' => $discount,
            'total' => ($quantity * $unitCost) - $discount,
        ]);
    }

    private function assertLinesEditable(PurchaseOrder $purchaseOrder): void
    {
        if (! in_array($purchaseOrder->status, self::LINES_EDITABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => 'This purchase order can no longer be edited.',
            ]);
        }
    }

    private function generatePoNumber(): string
    {
        // Numbering is global across every branch, never scoped to the
        // acting employee's own branch — bypass BranchScope explicitly so
        // a branch-scoped Purchasing user doesn't compute a number based
        // on only their own branch's POs and collide with another
        // branch's. Locks the latest row so two concurrent creates can't
        // compute the same next number — the second transaction blocks
        // here until the first commits, then sees its committed po_number.
        $lastNumber = PurchaseOrder::query()
            ->withoutGlobalScope(BranchScope::class)
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('po_number');

        $nextSequence = $lastNumber ? ((int) str_replace('PO-', '', $lastNumber)) + 1 : 1;

        return 'PO-'.str_pad((string) $nextSequence, 4, '0', STR_PAD_LEFT);
    }
}
