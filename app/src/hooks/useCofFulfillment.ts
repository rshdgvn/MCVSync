import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as fulfillmentApi from "@/api/cofFulfillment";
import { useMeQuery } from "@/hooks/useAuth";
import { cofKeys } from "@/hooks/useClientOrderForms";
import type { PickVariables } from "@/components/stock-flow/usePickFlow";
import { requireUserId } from "@/lib/offline/sendOrQueue";

export const cofFulfillmentKeys = {
  all: [...cofKeys.all, "fulfillment"] as const,
  queues: () => [...cofFulfillmentKeys.all, "queue"] as const,
  queue: (params: fulfillmentApi.FulfillmentQueueParams) => [...cofFulfillmentKeys.queues(), params] as const,
  detail: (id: number) => [...cofFulfillmentKeys.all, "detail", id] as const,
};

export function useFulfillmentQueueQuery(params: fulfillmentApi.FulfillmentQueueParams, enabled = true) {
  return useQuery({
    queryKey: cofFulfillmentKeys.queue(params),
    queryFn: () => fulfillmentApi.listFulfillmentQueue(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export const cofFulfillmentQueryOptions = (id: number) =>
  queryOptions({ queryKey: cofFulfillmentKeys.detail(id), queryFn: () => fulfillmentApi.getCofFulfillment(id) });

export function useCofFulfillmentQuery(id: number) {
  return useQuery({ ...cofFulfillmentQueryOptions(id), refetchOnWindowFocus: true, networkMode: "offlineFirst" });
}

function refreshFulfillment(queryClient: QueryClient, id: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: cofFulfillmentKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: cofFulfillmentKeys.queues() }),
    queryClient.invalidateQueries({ queryKey: cofKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: cofKeys.lists() }),
  ]);
}

export function useMatchCofPickMutation(id: number) {
  return useMutation({
    mutationFn: (scan: { barcode: string } | { item_id: number }) => fulfillmentApi.matchCofPick(id, scan),
  });
}

export function usePickCofStockMutation(id: number) {
  const queryClient = useQueryClient();
  const userId = useMeQuery().data?.id;

  return useMutation({
    mutationFn: ({ payload, lineId, label }: PickVariables) =>
      fulfillmentApi.pickCofStock(requireUserId(userId), id, payload, { lineId, label }),
    onSuccess: (outcome) =>
      outcome.queued
        ? undefined
        : Promise.all([
            refreshFulfillment(queryClient, id),
            queryClient.invalidateQueries({ queryKey: ["inventory", "items", outcome.data.client_order_form_item.item.id, "batches"] }),
          ]),
  });
}

export function useCompleteCofPickingMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fulfillmentApi.completeCofPicking(id),
    onSuccess: () => refreshFulfillment(queryClient, id),
  });
}
