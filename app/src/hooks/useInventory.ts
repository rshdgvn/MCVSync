import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as inventoryApi from "@/api/inventory";

const REFERENCE_DATA_STALE_TIME = 30 * 60 * 1000;

export const categoriesQueryKey = ["inventory", "categories"] as const;
export const unitsQueryKey = ["inventory", "units"] as const;
export const itemsQueryKey = (params: inventoryApi.ListItemsParams) =>
  ["inventory", "items", params] as const;
export const itemQueryKey = (id: number) => ["inventory", "items", id] as const;
export const itemBatchesQueryKey = (id: number, page: number) =>
  ["inventory", "items", id, "batches", page] as const;
export const itemStockQueryKey = (id: number) => ["inventory", "items", id, "stock"] as const;
export const itemTransactionsQueryKey = (id: number, page: number) =>
  ["inventory", "items", id, "transactions", page] as const;
export const expiringAlertsQueryKey = (params: inventoryApi.ListAlertsParams) =>
  ["inventory", "alerts", "expiring", params] as const;
export const lowStockAlertsQueryKey = (params: inventoryApi.ListAlertsParams) =>
  ["inventory", "alerts", "low-stock", params] as const;

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: inventoryApi.listCategories,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inventoryApi.createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: inventoryApi.CategoryPayload }) =>
      inventoryApi.updateCategory(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inventoryApi.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useUnitsQuery() {
  return useQuery({
    queryKey: unitsQueryKey,
    queryFn: inventoryApi.listUnits,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });
}

export function useCreateUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inventoryApi.createUnit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitsQueryKey }),
  });
}

export function useUpdateUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: inventoryApi.UnitPayload }) =>
      inventoryApi.updateUnit(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitsQueryKey }),
  });
}

export function useDeleteUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inventoryApi.deleteUnit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitsQueryKey }),
  });
}

export function useItemsQuery(params: inventoryApi.ListItemsParams) {
  return useQuery({
    queryKey: itemsQueryKey(params),
    queryFn: () => inventoryApi.listItems(params),
    placeholderData: keepPreviousData,
  });
}

export const itemQueryOptions = (id: number) =>
  queryOptions({ queryKey: itemQueryKey(id), queryFn: () => inventoryApi.getItem(id) });

export function useItemQuery(id: number) {
  return useQuery(itemQueryOptions(id));
}

export function useCreateItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory", "items"] }),
  });
}

export function useUpdateItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: inventoryApi.ItemPayload }) =>
      inventoryApi.updateItem(id, payload),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["inventory", "items"] }).then(() =>
        queryClient.invalidateQueries({ queryKey: itemQueryKey(variables.id) }),
      ),
  });
}

export function useItemBatchesQuery(id: number, page: number) {
  return useQuery({
    queryKey: itemBatchesQueryKey(id, page),
    queryFn: () => inventoryApi.listItemBatches(id, page),
    placeholderData: keepPreviousData,
  });
}

export function useItemStockQuery(id: number) {
  return useQuery({ queryKey: itemStockQueryKey(id), queryFn: () => inventoryApi.getItemStock(id) });
}

export function useItemTransactionsQuery(id: number, page: number) {
  return useQuery({
    queryKey: itemTransactionsQueryKey(id, page),
    queryFn: () => inventoryApi.listItemTransactions(id, page),
    placeholderData: keepPreviousData,
  });
}

export function useExpiringAlertsQuery(params: inventoryApi.ListAlertsParams = {}) {
  return useQuery({
    queryKey: expiringAlertsQueryKey(params),
    queryFn: () => inventoryApi.listExpiringAlerts(params),
    placeholderData: keepPreviousData,
  });
}

export function useLowStockAlertsQuery(params: inventoryApi.ListAlertsParams = {}) {
  return useQuery({
    queryKey: lowStockAlertsQueryKey(params),
    queryFn: () => inventoryApi.listLowStockAlerts(params),
    placeholderData: keepPreviousData,
  });
}
