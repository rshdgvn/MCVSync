import type { Item, Paginated } from "@/types/inventory";

export type DiscrepancyType = "short" | "over" | "not_found";

export type DiscrepancyReferenceType = "purchase_order" | "transfer_request";

export interface Discrepancy {
  id: number;
  reference_type: DiscrepancyReferenceType;
  reference_id: number;
  reference_number?: string | null;
  reference_item_type: string | null;
  reference_item_id: number | null;
  item: Item | null;
  type: DiscrepancyType;
  scanned_quantity: number | null;
  notes: string | null;
  resolved: boolean;
  resolved_by?: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string | null;
}

export interface DiscrepancyCounts {
  all: number;
  unresolved: number;
  resolved: number;
}

export interface DiscrepancyListResponse extends Paginated<Discrepancy> {
  counts: DiscrepancyCounts;
}
