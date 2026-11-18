import type { Batch, Item, Paginated } from "@/types/inventory";
import type { Branch } from "@/types/user";

export type TransferStatus = "awaiting_approval" | "pending" | "shipped" | "closed" | "cancelled" | "declined";

export interface TransferLine {
  id: number;
  item: Item;
  quantity_requested: number;
  quantity_picked: number;
  quantity_received: number;
}

interface TransferBase {
  id: number;
  transfer_number: string;
  status: TransferStatus;
  requesting_branch: Branch;
  fulfilling_branch: Branch;
  requested_by: string;
  shipped_at: string | null;
  received_at: string | null;
  remarks: string | null;
  decline_reason: string | null;
  decided_by?: string | null;
  decided_at: string | null;
  created_at: string | null;
}

export interface TransferSummary extends TransferBase {
  items_count: number;
}

export interface TransferDetail extends TransferBase {
  items: TransferLine[];
}

export type TransferStatusCounts = Record<TransferStatus | "all", number>;

export interface TransferListResponse extends Paginated<TransferSummary> {
  counts: TransferStatusCounts;
}

export type TransferPickMatch =
  | { status: "found"; transfer_request_item: TransferLine; remaining_quantity: number; suggested_batch: Batch | null }
  | { status: "not_found"; item: Item };

export interface InsufficientStock {
  reason: "insufficient_stock";
  message: string;
  item_id: number;
  branch_id: number;
  requested: number;
  available: number;
}

export interface FefoOverrideCode {
  code: string;
  expires_at: string;
}
