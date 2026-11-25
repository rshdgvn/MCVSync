import { queryClient } from "@/lib/queryClient";
import { itemQueryKey, itemStockQueryKey } from "@/hooks/useInventory";
import { receivingKeys, sessionHasItem } from "@/hooks/useReceiving";
import { transferHasItem, transferKeys } from "@/hooks/useTransfers";
import { notify } from "@/lib/notifications";
import type { Item, ItemStockBreakdown } from "@/types/inventory";

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

export function handleStockLevelChanged(payload: StockLevelChangedPayload) {
  void queryClient.invalidateQueries({
    queryKey: receivingKeys.all,
    predicate: (query) => sessionHasItem(query.state.data, payload.item_id),
  });
  void queryClient.invalidateQueries({
    queryKey: transferKeys.all,
    predicate: (query) => transferHasItem(query.state.data, payload.item_id),
  });
  void queryClient.invalidateQueries({ queryKey: ["inventory", "items", payload.item_id, "batches"] });
  void queryClient.invalidateQueries({ queryKey: ["inventory", "alerts", "expiring"] });

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

  void queryClient.invalidateQueries({ queryKey: ["inventory", "alerts", "low-stock"] });
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
