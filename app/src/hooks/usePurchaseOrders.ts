import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as purchaseOrdersApi from "@/api/purchaseOrders";

export const purchaseOrderKeys = {
  all: ["purchase-orders"] as const,
  lists: () => [...purchaseOrderKeys.all, "list"] as const,
  list: (params: purchaseOrdersApi.ListPurchaseOrdersParams) => [...purchaseOrderKeys.lists(), params] as const,
  detail: (id: number) => [...purchaseOrderKeys.all, "detail", id] as const,
};

export function usePurchaseOrdersQuery(params: purchaseOrdersApi.ListPurchaseOrdersParams) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(params),
    queryFn: () => purchaseOrdersApi.listPurchaseOrders(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export const purchaseOrderQueryOptions = (id: number) =>
  queryOptions({ queryKey: purchaseOrderKeys.detail(id), queryFn: () => purchaseOrdersApi.getPurchaseOrder(id) });

export function usePurchaseOrderQuery(id: number) {
  return useQuery({ ...purchaseOrderQueryOptions(id), refetchOnWindowFocus: true });
}

function refreshPurchaseOrder(queryClient: QueryClient, id: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() }),
  ]);
}

export function useCreatePurchaseOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: purchaseOrdersApi.createPurchaseOrder,
    onSuccess: (purchaseOrder) => {
      queryClient.setQueryData(purchaseOrderKeys.detail(purchaseOrder.id), purchaseOrder);
      return queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

export function useUpdatePurchaseOrderMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: purchaseOrdersApi.PurchaseOrderHeaderPayload) =>
      purchaseOrdersApi.updatePurchaseOrder(id, payload),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}

export function useAddPurchaseOrderLineMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: purchaseOrdersApi.NewPurchaseOrderLinePayload) =>
      purchaseOrdersApi.addPurchaseOrderLine(id, payload),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}

export function useUpdatePurchaseOrderLineMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: number; payload: purchaseOrdersApi.PurchaseOrderLinePayload }) =>
      purchaseOrdersApi.updatePurchaseOrderLine(id, lineId, payload),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}

export function useRemovePurchaseOrderLineMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineId: number) => purchaseOrdersApi.removePurchaseOrderLine(id, lineId),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}

export function useMarkPurchaseOrderReadyMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => purchaseOrdersApi.markPurchaseOrderReady(id),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}

export function useCancelPurchaseOrderMutation(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => purchaseOrdersApi.cancelPurchaseOrder(id),
    onSuccess: () => refreshPurchaseOrder(queryClient, id),
  });
}
