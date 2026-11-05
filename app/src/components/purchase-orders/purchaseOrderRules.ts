import type { PurchaseOrderStatus } from "@/types/purchaseOrder";

const LINES_EDITABLE: ReadonlySet<PurchaseOrderStatus> = new Set(["draft", "open"]);
const CANCELLABLE: ReadonlySet<PurchaseOrderStatus> = new Set(["draft", "open", "ready_for_delivery"]);

export const PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  "draft",
  "open",
  "ready_for_delivery",
  "closed",
  "cancelled",
];

export function canEditPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return LINES_EDITABLE.has(status);
}

export function canMarkPurchaseOrderReady(status: PurchaseOrderStatus): boolean {
  return status === "open";
}

export function canCancelPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return CANCELLABLE.has(status);
}

export function lineTotal(quantity: number, unitCost: number, discount: number): number {
  return quantity * unitCost - discount;
}
