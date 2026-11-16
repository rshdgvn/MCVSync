import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as pricingApi from "@/api/pricing";

export const pricingKeys = {
  all: ["pricing"] as const,
  items: (params: pricingApi.PricingSearchParams) => [...pricingKeys.all, "items", params] as const,
  clients: (params: pricingApi.PricingSearchParams) => [...pricingKeys.all, "clients", params] as const,
  prices: () => [...pricingKeys.all, "prices"] as const,
  priceList: (params: pricingApi.ListPricesParams) => [...pricingKeys.prices(), params] as const,
  histories: () => [...pricingKeys.all, "history"] as const,
  history: (clientId: number, itemId: number, page: number) => [...pricingKeys.histories(), clientId, itemId, page] as const,
  zoneAverages: () => [...pricingKeys.all, "zone-average"] as const,
  zoneAverage: (itemId: number, zoneId: number) => [...pricingKeys.zoneAverages(), itemId, zoneId] as const,
};

export function usePricedItemsQuery(params: pricingApi.PricingSearchParams) {
  return useQuery({
    queryKey: pricingKeys.items(params),
    queryFn: () => pricingApi.listPricedItems(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useCurrentPricesQuery(params: pricingApi.ListPricesParams, enabled = true) {
  return useQuery({
    queryKey: pricingKeys.priceList(params),
    queryFn: () => pricingApi.listCurrentPrices(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function usePriceHistoryQuery(clientId: number, itemId: number, page: number) {
  return useQuery({
    queryKey: pricingKeys.history(clientId, itemId, page),
    queryFn: () => pricingApi.listPriceHistory(clientId, itemId, page),
    placeholderData: keepPreviousData,
  });
}

export function useZoneAverageQuery(itemId: number | null, zoneId: number | null) {
  return useQuery({
    queryKey: pricingKeys.zoneAverage(itemId ?? 0, zoneId ?? 0),
    queryFn: () => pricingApi.getZoneAverage(itemId ?? 0, zoneId ?? 0),
    enabled: itemId !== null && zoneId !== null,
  });
}

export function useSetPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pricingApi.setPrice,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: pricingKeys.prices() }),
        queryClient.invalidateQueries({ queryKey: pricingKeys.histories() }),
        queryClient.invalidateQueries({ queryKey: pricingKeys.zoneAverages() }),
      ]),
  });
}
