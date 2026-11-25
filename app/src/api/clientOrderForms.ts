import { api } from "@/api/client";
import type { DocumentFile } from "@/hooks/useDocuments";
import type { CofDetail, CofListResponse, CofSource, CofStatus, CofSummary } from "@/types/clientOrderForm";

export interface ListCofsParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: CofStatus;
  source_type?: CofSource;
  client_id?: number;
}

export interface CofLinePayload {
  item_id: number;
  quantity: number;
  discount_percent: number;
  differs_from_request_reason?: string | null;
}

export interface CreateManualCofPayload {
  client_id: number;
  incoming_message_id: number;
  terms: string | null;
  request_delivery_date: string | null;
  remarks: string | null;
  items: CofLinePayload[];
}

export interface UpdateCofPayload {
  terms?: string | null;
  request_delivery_date?: string | null;
  remarks?: string | null;
  items?: CofLinePayload[];
}

const BASE_PATH = "/staff/client-order-forms";

const DR_STATUSES: ReadonlySet<CofStatus> = new Set(["ready_for_delivery", "delivered", "completed"]);

export function deliveryReceiptDocument(cof: Pick<CofSummary, "id" | "dr_number" | "order_status">): DocumentFile | null {
  if (!cof.dr_number || !DR_STATUSES.has(cof.order_status)) {
    return null;
  }
  return { path: `${BASE_PATH}/${cof.id}/delivery-receipt.pdf`, filename: `${cof.dr_number}.pdf` };
}

export async function listCofs(params: ListCofsParams = {}): Promise<CofListResponse> {
  const response = await api.get<CofListResponse>(BASE_PATH, { params });
  return response.data;
}

export async function getCof(id: number): Promise<CofDetail> {
  const response = await api.get<CofDetail>(`${BASE_PATH}/${id}`);
  return response.data;
}

export async function createManualCof(payload: CreateManualCofPayload): Promise<CofDetail> {
  const response = await api.post<CofDetail>(BASE_PATH, payload);
  return response.data;
}

export async function updateCof(id: number, payload: UpdateCofPayload): Promise<CofDetail> {
  const response = await api.patch<CofDetail>(`${BASE_PATH}/${id}`, payload);
  return response.data;
}

export async function forwardCof(id: number): Promise<CofDetail> {
  const response = await api.post<CofDetail>(`${BASE_PATH}/${id}/forward`);
  return response.data;
}

export async function sendCofForRevision(id: number, revisionReason: string): Promise<CofDetail> {
  const response = await api.post<CofDetail>(`${BASE_PATH}/${id}/send-for-revision`, { revision_reason: revisionReason });
  return response.data;
}

export async function cancelCof(id: number): Promise<CofDetail> {
  const response = await api.post<CofDetail>(`${BASE_PATH}/${id}/cancel`);
  return response.data;
}

export async function confirmCofCancellation(id: number): Promise<CofDetail> {
  const response = await api.post<CofDetail>(`${BASE_PATH}/${id}/cancellation/confirm`);
  return response.data;
}

export async function declineCofCancellation(id: number): Promise<CofDetail> {
  const response = await api.post<CofDetail>(`${BASE_PATH}/${id}/cancellation/decline`);
  return response.data;
}
