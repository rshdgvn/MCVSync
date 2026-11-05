import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as discrepanciesApi from "@/api/discrepancies";
import { receivingKeys } from "@/hooks/useReceiving";

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

export function useResolveDiscrepancyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) => discrepanciesApi.resolveDiscrepancy(id, note),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: discrepancyKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: receivingKeys.all }),
      ]),
  });
}
