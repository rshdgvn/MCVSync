import type { Branch } from "@/types/user";

export interface Category {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
}

export interface Item {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category: Category | null;
  unit: Unit | null;
  description: string | null;
  has_expiry: boolean;
  expiry_alert_threshold_days: number | null;
  effective_expiry_alert_threshold_days: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  available?: number;
}

export type BatchStatus = "active" | "expired" | "depleted";

export interface Batch {
  id: number;
  item?: Item;
  branch: Branch | null;
  batch_number: string;
  quantity: number;
  expiry_date: string | null;
  received_date: string;
  status: BatchStatus;
}

export interface ItemStockBreakdown {
  branch_id: number;
  branch_name: string;
  current: number;
  reserved: number;
  incoming: number;
  available: number;
}

export type StockTransactionType =
  | "receive"
  | "issue"
  | "transfer_out"
  | "transfer_in"
  | "adjustment"
  | "reserve"
  | "release";

export interface StockTransaction {
  id: number;
  item_id: number;
  batch_id: number | null;
  branch: Branch | null;
  type: StockTransactionType;
  quantity: number;
  reference_type: string | null;
  reference_id: number | null;
  performed_by: string | null;
  created_at: string;
}

export interface LowStockItem {
  item_id: number;
  item_name: string;
  sku: string;
  reorder_point: number;
  branch_id: number;
  branch_name: string;
  available: number;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  from: number | null;
  to: number | null;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ActiveStatusCounts {
  all: number;
  active: number;
  inactive: number;
}

export interface ItemListResponse extends Paginated<Item> {
  counts: ActiveStatusCounts;
}
