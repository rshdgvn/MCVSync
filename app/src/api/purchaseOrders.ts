import { api } from "@/api/client";
import type {
  PurchaseOrderDetail,
  PurchaseOrderLine,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
} from "@/types/purchaseOrder";

export interface ListPurchaseOrdersParams {
  page?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplier_id?: number;
  branch_id?: number;
}

export interface PurchaseOrderLinePayload {
  quantity_ordered: number;
  unit_cost: number;
  discount: number;
}

export interface NewPurchaseOrderLinePayload extends PurchaseOrderLinePayload {
  item_id: number;
}

export interface PurchaseOrderHeaderPayload {
  request_delivery_date: string | null;
  terms: string | null;
  remarks: string | null;
}

export interface CreatePurchaseOrderPayload extends PurchaseOrderHeaderPayload {
  supplier_id: number;
  branch_id: number;
  items: NewPurchaseOrderLinePayload[];
}

const BASE_PATH = "/staff/purchase-orders";

export async function listPurchaseOrders(params: ListPurchaseOrdersParams = {}): Promise<PurchaseOrderListResponse> {
  const response = await api.get<PurchaseOrderListResponse>(BASE_PATH, { params });
  return response.data;
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  const response = await api.get<PurchaseOrderDetail>(`${BASE_PATH}/${id}`);
  return response.data;
}

export async function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDetail> {
  const response = await api.post<PurchaseOrderDetail>(BASE_PATH, payload);
  return response.data;
}

export async function updatePurchaseOrder(id: number, payload: PurchaseOrderHeaderPayload): Promise<void> {
  await api.patch(`${BASE_PATH}/${id}`, payload);
}

export async function addPurchaseOrderLine(id: number, payload: NewPurchaseOrderLinePayload): Promise<PurchaseOrderLine> {
  const response = await api.post<PurchaseOrderLine>(`${BASE_PATH}/${id}/items`, payload);
  return response.data;
}

export async function updatePurchaseOrderLine(
  id: number,
  lineId: number,
  payload: PurchaseOrderLinePayload,
): Promise<PurchaseOrderLine> {
  const response = await api.patch<PurchaseOrderLine>(`${BASE_PATH}/${id}/items/${lineId}`, payload);
  return response.data;
}

export async function removePurchaseOrderLine(id: number, lineId: number): Promise<void> {
  await api.delete(`${BASE_PATH}/${id}/items/${lineId}`);
}

export async function markPurchaseOrderReady(id: number): Promise<void> {
  await api.post(`${BASE_PATH}/${id}/mark-ready`);
}

export async function cancelPurchaseOrder(id: number): Promise<void> {
  await api.post(`${BASE_PATH}/${id}/cancel`);
}
