import { api } from "@/api/client";
import type { Paginated } from "@/types/inventory";
import type { Payment, PaymentMethod, PendingPaymentListResponse } from "@/types/accounting";

export interface ListPaymentsParams {
  page?: number;
  per_page?: number;
}

export interface ApprovePaymentPayload {
  method: PaymentMethod;
  date_received: string;
  reference_note: string | null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank Transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

const REFERENCE_LABELS: Record<string, string> = {
  client_order_form: "Client Order Form",
};

export function paymentReferenceLabel(payment: Pick<Payment, "reference_type" | "reference_id">): string {
  return `${REFERENCE_LABELS[payment.reference_type] ?? payment.reference_type} #${payment.reference_id}`;
}

export async function listPendingPayments(params: ListPaymentsParams = {}): Promise<PendingPaymentListResponse> {
  const response = await api.get<PendingPaymentListResponse>("/staff/payments/pending", { params });
  return response.data;
}

export async function listPaymentHistory(params: ListPaymentsParams = {}): Promise<Paginated<Payment>> {
  const response = await api.get<Paginated<Payment>>("/staff/payments/history", { params });
  return response.data;
}

export async function approvePayment(id: number, payload: ApprovePaymentPayload): Promise<Payment> {
  const response = await api.post<Payment>(`/staff/payments/${id}/approve`, payload);
  return response.data;
}
