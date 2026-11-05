<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Builder;
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

    private const STATUSES = ['draft', 'open', 'ready_for_delivery', 'closed', 'cancelled'];

    public function __construct(private readonly DocumentNumberGenerator $numbers) {}

    /**
     * @param  array{search?: string, status?: string, supplier_id?: int, branch_id?: int}  $filters
     */
    public function listQuery(array $filters): Builder
    {
        return $this->filteredOrders($filters)
            ->with(['supplier', 'branch'])
            ->withCount('items')
            ->withSum('items', 'total')
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->orderByDesc('order_date')
            ->orderByDesc('id');
    }

    /**
     * @param  array{search?: string, supplier_id?: int, branch_id?: int}  $filters
     * @return array<string, int>
     */
    public function statusCounts(array $filters): array
    {
        $totals = $this->filteredOrders($filters)
            ->toBase()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $counts = ['all' => (int) $totals->sum()];
        foreach (self::STATUSES as $status) {
            $counts[$status] = (int) ($totals[$status] ?? 0);
        }

        return $counts;
    }

    /**
     * @param  array<int, array{item_id: int, quantity_ordered: int, unit_cost: float, discount?: float}>  $items
     */
    public function create(array $data, array $items, Employee $preparedBy): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items, $preparedBy) {
            $purchaseOrder = PurchaseOrder::create([
                ...$data,
                'po_number' => $this->numbers->next(PurchaseOrder::class, 'po_number', 'PO'),
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

    /**
     * @param  array{search?: string, supplier_id?: int, branch_id?: int}  $filters
     */
    private function filteredOrders(array $filters): Builder
    {
        return PurchaseOrder::query()
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $pattern = '%'.$search.'%';
                $query->where(fn (Builder $inner) => $inner
                    ->whereLike('po_number', $pattern)
                    ->orWhereHas('supplier', fn (Builder $supplier) => $supplier->whereLike('name', $pattern)));
            })
            ->when($filters['supplier_id'] ?? null, fn (Builder $query, int $supplierId) => $query->where('supplier_id', $supplierId))
            ->when($filters['branch_id'] ?? null, fn (Builder $query, int $branchId) => $query->where('branch_id', $branchId));
    }

    private function assertLinesEditable(PurchaseOrder $purchaseOrder): void
    {
        if (! in_array($purchaseOrder->status, self::LINES_EDITABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => 'This purchase order can no longer be edited.',
            ]);
        }
    }
}
