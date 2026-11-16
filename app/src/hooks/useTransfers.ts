import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as transfersApi from "@/api/transfers";
import { receivingKeys } from "@/hooks/useReceiving";

export const transferKeys = {
  all: ["transfers"] as const,
  lists: () => [...transferKeys.all, "list"] as const,
  list: (params: transfersApi.ListTransfersParams) => [...transferKeys.lists(), params] as const,
  detail: (id: number) => [...transferKeys.all, "detail", id] as const,
};

export function transferHasItem(data: unknown, itemId: number): boolean {
  const transfer = data as { items?: { item: { id: number } }[] } | undefined;
  return Boolean(transfer?.items?.some((line) => line.item.id === itemId));
}

export function useTransfersQuery(params: transfersApi.ListTransfersParams, enabled = true) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn: () => transfersApi.listTransfers(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export const transferQueryOptions = (id: number) =>
  queryOptions({ queryKey: transferKeys.detail(id), queryFn: () => transfersApi.getTransfer(id) });

export function useTransferQuery(id: number) {
  return useQuery({ ...transferQueryOptions(id), refetchOnWindowFocus: true });
}

function refreshTransfer(queryClient: QueryClient, id: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: transferKeys.lists() }),
  ]);
}

export function useCreateTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transfersApi.createTransfer,
    onSuccess: (transfer) => {
      queryClient.setQueryData(transferKeys.detail(transfer.id), transfer);
      return queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
    },
  });
}

export function useShipTransferMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transfersApi.shipTransfer(id),
    onSuccess: () =>
      Promise.all([refreshTransfer(queryClient, id), queryClient.invalidateQueries({ queryKey: receivingKeys.all })]),
  });
}

export function useCancelTransferMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transfersApi.cancelTransfer(id),
    onSuccess: () => refreshTransfer(queryClient, id),
  });
}

export function useMatchPickMutation(id: number) {
  return useMutation({
    mutationFn: (scan: { barcode: string } | { item_id: number }) => transfersApi.matchPick(id, scan),
  });
}

export function usePickStockMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: transfersApi.PickPayload) => transfersApi.pickStock(id, payload),
    onSuccess: (line) =>
      Promise.all([
        refreshTransfer(queryClient, id),
        queryClient.invalidateQueries({ queryKey: ["inventory", "items", line.item.id, "batches"] }),
      ]),
  });
}

export function useGenerateFefoOverrideMutation() {
  return useMutation({ mutationFn: transfersApi.generateFefoOverrideCode });
}
