import type { Item, Paginated } from "@/types/inventory";

export interface Zone {
  id: number;
  name: string;
}

export interface Client {
  id: number;
  name: string;
  contact: string | null;
  address: string | null;
  client_type: string;
  zone: Zone | null;
}

export interface ClientItemPrice {
  id: number;
  client: Client;
  item: Item;
  srp: number;
  set_by: string;
  created_at: string;
}

export type PaymentStatus = "payment_due" | "paid";

export type PaymentMethod = "bank_transfer" | "check" | "cash" | "other";

export interface Payment {
  id: number;
  reference_type: string;
  reference_id: number;
  order_total: number;
  payment_terms: string;
  expected_payment_date: string | null;
  status: PaymentStatus;
  method: PaymentMethod | null;
  date_received: string | null;
  reference_note: string | null;
  approved_by?: string | null;
  approved_at: string | null;
  days_overdue?: number | null;
}

export interface PendingPaymentSummary {
  total: number;
  overdue: number;
  within_terms: number;
}

export interface PendingPaymentListResponse extends Paginated<Payment> {
  summary: PendingPaymentSummary;
}

export type ItemWithCogs = Item & { cogs: number | null };

export type PricedItemList = Paginated<ItemWithCogs>;
