import { api } from "@/api/client";
import type {
  Batch,
  Category,
  Item,
  ItemStockBreakdown,
  LowStockItem,
  Paginated,
  StockTransaction,
  Unit,
} from "@/types/inventory";

export async function listCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>("/staff/inventory/categories");
  return response.data;
}

export interface CategoryPayload {
  name: string;
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const response = await api.post<Category>("/staff/inventory/categories", payload);
  return response.data;
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<Category> {
  const response = await api.patch<Category>(`/staff/inventory/categories/${id}`, payload);
  return response.data;
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/staff/inventory/categories/${id}`);
}

export async function listUnits(): Promise<Unit[]> {
  const response = await api.get<Unit[]>("/staff/inventory/units");
  return response.data;
}

export interface UnitPayload {
  code: string;
  name: string;
}

export async function createUnit(payload: UnitPayload): Promise<Unit> {
  const response = await api.post<Unit>("/staff/inventory/units", payload);
  return response.data;
}

export async function updateUnit(id: number, payload: UnitPayload): Promise<Unit> {
  const response = await api.patch<Unit>(`/staff/inventory/units/${id}`, payload);
  return response.data;
}

export async function deleteUnit(id: number): Promise<void> {
  await api.delete(`/staff/inventory/units/${id}`);
}

export interface ListItemsParams {
  page?: number;
  search?: string;
  category_id?: number;
  is_active?: boolean;
}

export async function listItems(params: ListItemsParams = {}): Promise<Paginated<Item>> {
  const response = await api.get<Paginated<Item>>("/staff/inventory/items", { params });
  return response.data;
}

export interface ItemPayload {
  name: string;
  sku: string;
  barcode: string | null;
  category_id: number;
  unit_id: number;
  description: string | null;
  has_expiry: boolean;
  expiry_alert_threshold_days: number | null;
  reorder_point: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
}

export async function getItem(id: number): Promise<Item> {
  const response = await api.get<Item>(`/staff/inventory/items/${id}`);
  return response.data;
}

export async function createItem(payload: ItemPayload): Promise<Item> {
  const response = await api.post<Item>("/staff/inventory/items", payload);
  return response.data;
}

export async function updateItem(id: number, payload: ItemPayload): Promise<Item> {
  const response = await api.patch<Item>(`/staff/inventory/items/${id}`, payload);
  return response.data;
}

export async function listItemBatches(id: number, page = 1): Promise<Paginated<Batch>> {
  const response = await api.get<Paginated<Batch>>(`/staff/inventory/items/${id}/batches`, {
    params: { page },
  });
  return response.data;
}

export async function getItemStock(id: number): Promise<ItemStockBreakdown[]> {
  const response = await api.get<ItemStockBreakdown[]>(`/staff/inventory/items/${id}/stock`);
  return response.data;
}

export async function listItemTransactions(
  id: number,
  page = 1,
): Promise<Paginated<StockTransaction>> {
  const response = await api.get<Paginated<StockTransaction>>(`/staff/inventory/items/${id}/transactions`, {
    params: { page },
  });
  return response.data;
}

export interface ListAlertsParams {
  page?: number;
  per_page?: number;
}

export async function listExpiringAlerts(
  params: ListAlertsParams = {},
): Promise<Paginated<Batch>> {
  const response = await api.get<Paginated<Batch>>("/staff/inventory/alerts/expiring", { params });
  return response.data;
}

export async function listLowStockAlerts(
  params: ListAlertsParams = {},
): Promise<Paginated<LowStockItem>> {
  const response = await api.get<Paginated<LowStockItem>>("/staff/inventory/alerts/low-stock", {
    params,
  });
  return response.data;
}
