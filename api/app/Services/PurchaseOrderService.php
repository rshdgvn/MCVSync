<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Scopes\BranchScope;
use App\Support\BusinessDate;
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

    private const PRICED_STATUSES = ['open', 'ready_for_delivery', 'closed'];

    private const INCOMING_STATUSES = ['open', 'ready_for_delivery'];

    public function __construct(
        private readonly DocumentNumberGenerator $numbers,
        private readonly StockAvailabilityService $availability,
    ) {}

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
            ->when($filters['item_id'] ?? null, fn (Builder $query, int $itemId) => $query->whereHas('items', fn (Builder $lines) => $lines->where('item_id', $itemId)))
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
                'order_date' => $data['order_date'] ?? BusinessDate::todayString(),
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

        if (array_key_exists('supplier_id', $data) && $purchaseOrder->status !== 'draft') {
            throw ValidationException::withMessages([
                'supplier_id' => 'The supplier can only be changed while the purchase order is a draft.',
            ]);
        }

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
        DB::transaction(function () use ($item) {
            $purchaseOrder = PurchaseOrder::query()->lockForUpdate()->findOrFail($item->purchase_order_id);
            $this->assertLinesEditable($purchaseOrder);

            if ($purchaseOrder->items()->count() <= 1) {
                throw ValidationException::withMessages([
                    'item' => 'A purchase order needs at least one item. Add another item before removing this one.',
                ]);
            }

            $item->delete();
        });
    }

    public function finalize(PurchaseOrder $purchaseOrder, Employee $finalizedBy): PurchaseOrder
    {
        return DB::transaction(function () use ($purchaseOrder, $finalizedBy) {
            $locked = PurchaseOrder::query()->lockForUpdate()->findOrFail($purchaseOrder->id);

            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => 'Only a draft purchase order can be finalized.',
                ]);
            }

            if ($locked->supplier_id === null) {
                throw ValidationException::withMessages([
                    'supplier_id' => 'Choose a supplier before finalizing this purchase order.',
                ]);
            }

            if ($locked->items()->where('unit_cost', '<=', 0)->exists()) {
                throw ValidationException::withMessages([
                    'items' => 'Enter a unit cost for every item before finalizing this purchase order.',
                ]);
            }

            $locked->update([
                'status' => 'open',
                'prepared_by' => $locked->prepared_by ?? $finalizedBy->id,
            ]);

            return $locked;
        });
    }

    public function draftForLowStock(int $itemId, int $branchId): ?PurchaseOrder
    {
        $item = Item::query()->find($itemId);

        if ($item?->reorder_point === null) {
            return null;
        }

        $available = $this->availability->available($itemId, $branchId);
        $quantity = $item->reorder_quantity > 0
            ? $item->reorder_quantity
            : max($item->reorder_point * 2 - $available, 1);

        return $this->addToDraft($item, $branchId, 'auto_low_stock', $quantity);
    }

    public function draftForShortageAfterTransaction(InsufficientStockException $shortage): void
    {
        $draft = fn () => rescue(fn () => $this->addToDraft(
            Item::query()->findOrFail($shortage->itemId),
            $shortage->branchId,
            'auto_shortage',
            max($shortage->requested - $shortage->available, 1),
        ));

        DB::afterCommit($draft);
        DB::afterRollBack($draft);
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

    private function addToDraft(Item $item, int $branchId, string $source, int $needed): ?PurchaseOrder
    {
        return DB::transaction(function () use ($item, $branchId, $source, $needed) {
            Branch::query()->whereKey($branchId)->lockForUpdate()->firstOrFail();

            $quantity = $needed - $this->incomingQuantity($item->id, $branchId);

            if ($quantity <= 0) {
                return null;
            }

            $draft = PurchaseOrder::query()
                ->withoutGlobalScope(BranchScope::class)
                ->where('branch_id', $branchId)
                ->where('status', 'draft')
                ->where('supplier_id', $item->preferred_supplier_id)
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            if ($draft?->items()->where('item_id', $item->id)->exists()) {
                return $draft;
            }

            $draft ??= PurchaseOrder::create([
                'po_number' => $this->numbers->next(PurchaseOrder::class, 'po_number', 'PO'),
                'supplier_id' => $item->preferred_supplier_id,
                'branch_id' => $branchId,
                'status' => 'draft',
                'source' => $source,
                'order_date' => BusinessDate::todayString(),
            ]);

            $this->createLine($draft, [
                'item_id' => $item->id,
                'quantity_ordered' => $quantity,
                'unit_cost' => $this->lastPaidUnitCost($item->id, $branchId),
            ]);

            return $draft;
        });
    }

    private function incomingQuantity(int $itemId, int $branchId): int
    {
        return (int) PurchaseOrderItem::query()
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_order_items.item_id', $itemId)
            ->where('purchase_orders.branch_id', $branchId)
            ->whereIn('purchase_orders.status', self::INCOMING_STATUSES)
            ->sum(DB::raw('purchase_order_items.quantity_ordered - purchase_order_items.quantity_received'));
    }

    private function lastPaidUnitCost(int $itemId, int $branchId): float
    {
        return (float) (PurchaseOrderItem::query()
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_order_items.item_id', $itemId)
            ->whereIn('purchase_orders.status', self::PRICED_STATUSES)
            ->orderByRaw('CASE WHEN purchase_orders.branch_id = ? THEN 0 ELSE 1 END', [$branchId])
            ->orderByDesc('purchase_orders.order_date')
            ->orderByDesc('purchase_order_items.id')
            ->value('purchase_order_items.unit_cost') ?? 0);
    }

    /**
     * @param  array{search?: string, supplier_id?: int, branch_id?: int, item_id?: int}  $filters
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
