import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as discrepanciesApi from "@/api/discrepancies";
import { purchaseOrderKeys } from "@/hooks/usePurchaseOrders";
import { receivingKeys } from "@/hooks/useReceiving";
import { transferKeys } from "@/hooks/useTransfers";
import type { DiscrepancyResolution } from "@/types/discrepancy";

export const discrepancyKeys = {
  all: ["discrepancies"] as const,
  lists: () => [...discrepancyKeys.all, "list"] as const,
  list: (params: discrepanciesApi.ListDiscrepanciesParams) => [...discrepancyKeys.lists(), params] as const,
};

export function useDiscrepanciesQuery(params: discrepanciesApi.ListDiscrepanciesParams) {
  return useQuery({
    queryKey: discrepancyKeys.list(params),
    queryFn: () => discrepanciesApi.listDiscrepancies(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

interface ResolveDiscrepancyInput {
  id: number;
  resolution: DiscrepancyResolution;
  note: string | null;
  itemId: number | null;
}

export function useResolveDiscrepancyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolution, note, itemId }: ResolveDiscrepancyInput) =>
      discrepanciesApi.resolveDiscrepancy(id, resolution, note, itemId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: discrepancyKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: receivingKeys.all }),
        queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all }),
        queryClient.invalidateQueries({ queryKey: transferKeys.all }),
      ]),
  });
}
