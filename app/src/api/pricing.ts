import { api } from "@/api/client";
import type { Paginated } from "@/types/inventory";
import type { Client, ClientItemPrice, PricedItemList } from "@/types/accounting";

export interface PricingSearchParams {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface ListPricesParams {
  page?: number;
  per_page?: number;
  client_id?: number;
  item_id?: number;
}

export interface SetPricePayload {
  client_id: number;
  item_id: number;
  srp: number;
}

const BASE_PATH = "/staff/pricing";

export async function listPricedItems(params: PricingSearchParams = {}): Promise<PricedItemList> {
  const response = await api.get<PricedItemList>(`${BASE_PATH}/items`, { params });
  return response.data;
}

export async function listPricingClients(params: PricingSearchParams = {}): Promise<Paginated<Client>> {
  const response = await api.get<Paginated<Client>>(`${BASE_PATH}/clients`, { params });
  return response.data;
}

export async function listCurrentPrices(params: ListPricesParams = {}): Promise<Paginated<ClientItemPrice>> {
  const response = await api.get<Paginated<ClientItemPrice>>(`${BASE_PATH}/client-item-prices`, { params });
  return response.data;
}

export async function listPriceHistory(clientId: number, itemId: number, page = 1): Promise<Paginated<ClientItemPrice>> {
  const response = await api.get<Paginated<ClientItemPrice>>(`${BASE_PATH}/client-item-prices/history`, {
    params: { client_id: clientId, item_id: itemId, page },
  });
  return response.data;
}

export async function getZoneAverage(itemId: number, zoneId: number): Promise<number | null> {
  const response = await api.get<{ average: number | string | null }>(`${BASE_PATH}/client-item-prices/zone-average`, {
    params: { item_id: itemId, zone_id: zoneId },
  });
  return response.data.average === null ? null : Number(response.data.average);
}

export async function setPrice(payload: SetPricePayload): Promise<ClientItemPrice> {
  const response = await api.post<ClientItemPrice>(`${BASE_PATH}/client-item-prices`, payload);
  return response.data;
}
