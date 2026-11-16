import { isAxiosError } from "axios";
import { api } from "@/api/client";
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

export async function getTransfer(id: number): Promise<TransferDetail> {
  const response = await api.get<TransferDetail>(`${BASE_PATH}/${id}`);
  return response.data;
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

export async function pickStock(id: number, payload: PickPayload): Promise<TransferLine> {
  const response = await api.post<TransferLine>(`${BASE_PATH}/${id}/fulfill/pick`, payload);
  return response.data;
}

export async function generateFefoOverrideCode(): Promise<FefoOverrideCode> {
  const response = await api.post<FefoOverrideCode>("/staff/fefo-overrides");
  return response.data;
}
