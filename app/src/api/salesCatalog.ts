import { api } from "@/api/client";
import type { Paginated } from "@/types/inventory";
import type { ClientProfile, SalesItem } from "@/types/clientOrderForm";

interface StandingDiscount {
  item: { id: number } | null;
  discount_percent: number;
}

const STANDING_DISCOUNT_PAGE_SIZE = 100;

export interface CatalogSearchParams {
  search?: string;
  per_page?: number;
}

export async function searchSalesItems(params: CatalogSearchParams): Promise<Paginated<SalesItem>> {
  const response = await api.get<Paginated<SalesItem>>("/staff/sales/items", { params });
  return response.data;
}

export async function standingDiscounts(clientId: number): Promise<Map<number, number>> {
  const response = await api.get<Paginated<StandingDiscount>>("/staff/client-discounts", {
    params: { client_id: clientId, per_page: STANDING_DISCOUNT_PAGE_SIZE },
  });
  return new Map(
    response.data.data.flatMap((discount) => (discount.item ? [[discount.item.id, discount.discount_percent] as const] : [])),
  );
}

export async function getClient(id: number): Promise<ClientProfile> {
  const response = await api.get<ClientProfile>(`/staff/clients/${id}`);
  return response.data;
}

export async function searchClients(params: CatalogSearchParams): Promise<Paginated<ClientProfile>> {
  const response = await api.get<Paginated<ClientProfile>>("/staff/clients", { params });
  return response.data;
}
