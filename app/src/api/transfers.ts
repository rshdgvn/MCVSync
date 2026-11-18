import { isAxiosError } from "axios";
import { api } from "@/api/client";
import { db } from "@/db/schema";
import { withOfflineCache } from "@/lib/offline/offlineCache";
import { sendOrQueue, type SendOutcome } from "@/lib/offline/sendOrQueue";
import type {
  FefoOverrideCode,
  InsufficientStock,
  TransferDetail,
  TransferLine,
  TransferListResponse,
  TransferPickMatch,
  TransferStatus,
} from "@/types/transfer";

export interface ListTransfersParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: TransferStatus;
  requesting_branch_id?: number;
}

export interface CreateTransferPayload {
  requesting_branch_id: number | null;
  remarks: string | null;
  items: { item_id: number; quantity: number }[];
}

export interface PickPayload {
  item_id: number;
  quantity: number;
  batch_id: number | null;
  override_code: string | null;
  override_reason: string | null;
}

const BASE_PATH = "/staff/transfers";

const TRANSFER_STATUS_DISPLAY: Record<TransferStatus, string> = {
  pending: "requested",
  shipped: "shipped",
  closed: "received",
  cancelled: "cancelled",
};

export function transferStatusKey(status: TransferStatus): string {
  return TRANSFER_STATUS_DISPLAY[status];
}

export function insufficientStockOf(error: unknown): InsufficientStock | null {
  if (isAxiosError<InsufficientStock>(error) && error.response?.data?.reason === "insufficient_stock") {
    return error.response.data;
  }
  return null;
}

export async function listTransfers(params: ListTransfersParams = {}): Promise<TransferListResponse> {
  const response = await api.get<TransferListResponse>(BASE_PATH, { params });
  return response.data;
}

export function transferCacheKey(id: number): string {
  return `transfer:${id}`;
}

export function pickScope(id: number): string {
  return `pick:transfer_request:${id}`;
}

export function getTransfer(id: number): Promise<TransferDetail> {
  return withOfflineCache(db.cached_orders, transferCacheKey(id), async () => {
    const response = await api.get<TransferDetail>(`${BASE_PATH}/${id}`);
    return response.data;
  });
}

export async function createTransfer(payload: CreateTransferPayload): Promise<TransferDetail> {
  const response = await api.post<TransferDetail>(BASE_PATH, payload);
  return response.data;
}

export async function shipTransfer(id: number): Promise<TransferDetail> {
  const response = await api.post<TransferDetail>(`${BASE_PATH}/${id}/ship`);
  return response.data;
}

export async function cancelTransfer(id: number): Promise<TransferDetail> {
  const response = await api.post<TransferDetail>(`${BASE_PATH}/${id}/cancel`);
  return response.data;
}

export async function matchPick(id: number, scan: { barcode: string } | { item_id: number }): Promise<TransferPickMatch> {
  const response = await api.post<TransferPickMatch>(`${BASE_PATH}/${id}/fulfill/match`, scan);
  return response.data;
}

export function pickStock(
  userId: number,
  id: number,
  payload: PickPayload,
  change: { lineId: number; label: string },
): Promise<SendOutcome<TransferLine>> {
  return sendOrQueue<TransferLine>(
    userId,
    { method: "POST", url: `${BASE_PATH}/${id}/fulfill/pick`, payload },
    { scope: pickScope(id), line_id: change.lineId, quantity: payload.quantity, label: change.label },
  );
}

export async function generateFefoOverrideCode(): Promise<FefoOverrideCode> {
  const response = await api.post<FefoOverrideCode>("/staff/fefo-overrides");
  return response.data;
}
