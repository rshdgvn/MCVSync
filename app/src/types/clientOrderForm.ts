import type { Payment } from "@/types/accounting";
import type { Discrepancy } from "@/types/discrepancy";
import type { Item, Paginated } from "@/types/inventory";
import type { Branch } from "@/types/user";

export type CofStatus =
  | "pending_approval"
  | "needs_revision"
  | "processing"
  | "ready_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export type CofSource = "portal" | "manual";

export type MessageChannel = "messenger" | "viber" | "email";

export type MessageStatus = "received" | "converted";

export interface ClientZone {
  id: number;
  name: string;
}

export interface ClientProfile {
  id: number;
  name: string;
  email: string;
  contact: string;
  address: string;
  client_type: "direct" | "reseller";
  zone: ClientZone | null;
  branch?: Branch;
  created_at: string | null;
}

export interface SalesItem {
  id: number;
  name: string;
  sku: string;
  category: { id: number; name: string } | null;
  unit: { id: number; code: string; name: string } | null;
}

export interface CofLine {
  id: number;
  item: Item;
  quantity: number;
  quantity_picked: number;
  unit_cost: number | null;
  suggested_unit_cost?: number | null;
  discount_percent: number;
  total: number | null;
  differs_from_request: boolean;
  differs_from_request_reason: string | null;
}

export interface CofDispatchHold {
  note: string | null;
  held_by: string | null;
  held_at: string;
}

export interface CofIssue {
  description: string | null;
  reported_at: string;
}

export interface CofDelivery {
  delivery_date: string;
  received_by: string;
}

export interface CofSummary {
  id: number;
  cof_number: string;
  dr_number: string | null;
  client?: ClientProfile;
  branch?: Branch;
  source_type: CofSource;
  source_id: number;
  order_status: CofStatus;
  cancellation_requested: boolean;
  ready_for_delivery_at: string | null;
  prepared_by?: string | null;
  checked_by?: string | null;
  terms: string | null;
  request_delivery_date: string | null;
  remarks: string | null;
  revision_reason: string | null;
  dispatch_hold: CofDispatchHold | null;
  issue: CofIssue | null;
  items_count?: number;
  total: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CofSubmission {
  id: number;
  notes: string | null;
  submitted_at: string | null;
  items: { item: Item; quantity: number }[];
}

export interface CofDetail extends CofSummary {
  items: CofLine[];
  delivery: CofDelivery | null;
  needs_pricing_item_ids: number[];
  source: CofSubmission | null;
  source_message: IncomingMessage | null;
  discrepancies: Discrepancy[];
  payment: Payment | null;
}

export type CofStatusCounts = Record<CofStatus | "all", number>;

export interface CofListResponse extends Paginated<CofSummary> {
  counts: CofStatusCounts;
}

export interface IncomingMessage {
  id: number;
  client?: ClientProfile;
  channel: MessageChannel;
  attachment_name: string;
  notes: string | null;
  received_at: string | null;
  status: MessageStatus;
  converted_cof_id: number | null;
  converted_cof_number?: string | null;
  logged_by?: string | null;
}
