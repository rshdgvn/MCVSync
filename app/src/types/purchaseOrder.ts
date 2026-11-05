import type { Item, Paginated } from "@/types/inventory";
import type { Supplier } from "@/types/supplier";
import type { Branch } from "@/types/user";

export type PurchaseOrderStatus = "draft" | "open" | "ready_for_delivery" | "closed" | "cancelled";

interface PurchaseOrderBase {
  id: number;
  po_number: string;
  supplier: Supplier;
  branch: Branch;
  status: PurchaseOrderStatus;
  order_date: string;
  request_delivery_date: string | null;
  terms: string | null;
  remarks: string | null;
  source_type: string | null;
  source_id: number | null;
}

export interface PurchaseOrderSummary extends PurchaseOrderBase {
  items_count: number;
  total: number;
}

export interface PurchaseOrderLine {
  id: number;
  item: Item;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  discount: number;
  total: number;
}

export interface PurchaseOrderDetail extends PurchaseOrderBase {
  prepared_by: string;
  items: PurchaseOrderLine[];
  total: number;
}

export type PurchaseOrderStatusCounts = Record<PurchaseOrderStatus | "all", number>;

export interface PurchaseOrderListResponse extends Paginated<PurchaseOrderSummary> {
  counts: PurchaseOrderStatusCounts;
}
