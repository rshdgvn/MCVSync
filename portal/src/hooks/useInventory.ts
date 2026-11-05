import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as inventoryApi from "@/api/inventory";

const REFERENCE_DATA_STALE_TIME = 30 * 60 * 1000;

export const itemsQueryKey = (params: inventoryApi.ListItemsParams) =>
  ["items", params] as const;
export const categoriesQueryKey = ["categories"] as const;

export function useItemsQuery(params: inventoryApi.ListItemsParams) {
  return useQuery({
    queryKey: itemsQueryKey(params),
    queryFn: () => inventoryApi.listItems(params),
    placeholderData: keepPreviousData,
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: inventoryApi.listCategories,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });
}
