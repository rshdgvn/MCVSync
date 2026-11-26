import { api } from "@/api/client";
import type { PickPayload } from "@/api/transfers";
import { db } from "@/db/schema";
import { withOfflineCache } from "@/lib/offline/offlineCache";
import { sendOrQueue, type SendOutcome } from "@/lib/offline/sendOrQueue";
import type { CofFulfillment, CofFulfillmentDetail, CofPickMatch, CofPickResult } from "@/types/clientOrderForm";
import type { Paginated } from "@/types/inventory";

export interface FulfillmentQueueParams {
  page?: number;
  per_page?: number;
}

const BASE_PATH = "/staff/client-order-forms";

export function cofPickScope(id: number): string {
  return `pick:client_order_form:${id}`;
}

export function cofFulfillmentCacheKey(id: number): string {
  return `cof-fulfillment:${id}`;
}

export async function listFulfillmentQueue(params: FulfillmentQueueParams = {}): Promise<Paginated<CofFulfillment>> {
  const response = await api.get<Paginated<CofFulfillment>>(`${BASE_PATH}/fulfillment-queue`, { params });
  return response.data;
}

export function getCofFulfillment(id: number): Promise<CofFulfillmentDetail> {
  return withOfflineCache(db.cached_orders, cofFulfillmentCacheKey(id), async () => {
    const response = await api.get<CofFulfillmentDetail>(`${BASE_PATH}/${id}/fulfill`);
    return response.data;
  });
}

export async function matchCofPick(id: number, scan: { barcode: string } | { item_id: number }): Promise<CofPickMatch> {
  const response = await api.post<CofPickMatch>(`${BASE_PATH}/${id}/fulfill/match`, scan);
  return response.data;
}

export function pickCofStock(
  userId: number,
  id: number,
  payload: PickPayload,
  change: { lineId: number; label: string },
): Promise<SendOutcome<CofPickResult>> {
  return sendOrQueue<CofPickResult>(
    userId,
    { method: "POST", url: `${BASE_PATH}/${id}/fulfill/pick`, payload },
    { scope: cofPickScope(id), line_id: change.lineId, quantity: payload.quantity, label: change.label },
  );
}

export async function completeCofPicking(id: number): Promise<CofFulfillmentDetail> {
  const response = await api.post<CofFulfillmentDetail>(`${BASE_PATH}/${id}/fulfill/complete`);
  return response.data;
}
