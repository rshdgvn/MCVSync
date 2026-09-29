import { queryClient } from "@/lib/queryClient";
import { itemQueryKey, itemStockQueryKey, lowStockAlertsQueryKey } from "@/hooks/useInventory";
import { notify } from "@/lib/notifications";
import type { Item, ItemStockBreakdown, LowStockItem, Paginated } from "@/types/inventory";

export interface StockLevelChangedPayload {
  item_id: number;
  branch_id: number;
  available: number;
  reserved: number;
  current: number;
}

export interface LowStockThresholdCrossedPayload {
  item_id: number;
  branch_id: number;
  available: number;
  reorder_point: number;
}

const badgeSetQueryKey = lowStockAlertsQueryKey({ per_page: 100 });

export function handleStockLevelChanged(payload: StockLevelChangedPayload) {
  queryClient.setQueryData<ItemStockBreakdown[]>(itemStockQueryKey(payload.item_id), (old) => {
    if (!old) {
      return old;
    }

    return old.map((row) =>
      row.branch_id === payload.branch_id
        ? { ...row, available: payload.available, reserved: payload.reserved, current: payload.current }
        : row,
    );
  });

  /**
   * LowStockThresholdCrossed only fires when available newly crosses AT
   * OR BELOW reorder_point, never on recovery back above it — so the
   * badge Set has no other signal telling it an item is no longer low.
   * Growth into "low" is instead handled by LowStockThresholdCrossed's
   * invalidate below, which also refreshes this same cache entry.
   */
  queryClient.setQueryData<Paginated<LowStockItem>>(badgeSetQueryKey, (old) => {
    if (!old) {
      return old;
    }

    const row = old.data.find(
      (item) => item.item_id === payload.item_id && item.branch_id === payload.branch_id,
    );

    if (!row || payload.available <= row.reorder_point) {
      return old;
    }

    return { ...old, data: old.data.filter((item) => item !== row) };
  });
}

export function handleLowStockThresholdCrossed(payload: LowStockThresholdCrossedPayload) {
  const itemName = queryClient.getQueryData<Item>(itemQueryKey(payload.item_id))?.name
    ?? `Item #${payload.item_id}`;

  notify("system", {
    title: "Low stock alert",
    body: `${itemName} is at ${payload.available}, at or below its reorder point of ${payload.reorder_point}.`,
  });

  queryClient.invalidateQueries({ queryKey: ["inventory", "alerts", "low-stock"] });
}
