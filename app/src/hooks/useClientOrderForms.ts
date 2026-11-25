import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as cofsApi from "@/api/clientOrderForms";
import { standingDiscounts } from "@/api/salesCatalog";
import { messageKeys } from "@/hooks/useIncomingMessages";
import type { CofDetail } from "@/types/clientOrderForm";

export const cofKeys = {
  all: ["client-order-forms"] as const,
  lists: () => [...cofKeys.all, "list"] as const,
  list: (params: cofsApi.ListCofsParams) => [...cofKeys.lists(), params] as const,
  detail: (id: number) => [...cofKeys.all, "detail", id] as const,
};

export const salesCatalogKeys = {
  items: (search: string) => ["sales-items", search] as const,
  clients: (search: string) => ["sales-clients", search] as const,
  client: (id: number) => ["sales-clients", "detail", id] as const,
  discounts: (clientId: number) => ["sales-standing-discounts", clientId] as const,
};

export function useStandingDiscountsQuery(clientId: number | null) {
  return useQuery({
    queryKey: salesCatalogKeys.discounts(clientId ?? 0),
    queryFn: () => standingDiscounts(clientId ?? 0),
    enabled: clientId !== null,
    staleTime: 60_000,
  });
}

export function useCofsQuery(params: cofsApi.ListCofsParams, enabled = true) {
  return useQuery({
    queryKey: cofKeys.list(params),
    queryFn: () => cofsApi.listCofs(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export const cofQueryOptions = (id: number) => queryOptions({ queryKey: cofKeys.detail(id), queryFn: () => cofsApi.getCof(id) });

export function useCofQuery(id: number) {
  return useQuery({ ...cofQueryOptions(id), refetchOnWindowFocus: true });
}

function storeDetail(queryClient: QueryClient, cof: CofDetail) {
  queryClient.setQueryData(cofKeys.detail(cof.id), cof);
  return queryClient.invalidateQueries({ queryKey: cofKeys.lists() });
}

function useCofMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<CofDetail>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (cof) => storeDetail(queryClient, cof),
  });
}

export function useCreateManualCofMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cofsApi.createManualCof,
    onSuccess: (cof) =>
      Promise.all([storeDetail(queryClient, cof), queryClient.invalidateQueries({ queryKey: messageKeys.all })]),
  });
}

export function useUpdateCofMutation(id: number) {
  return useCofMutation((payload: cofsApi.UpdateCofPayload) => cofsApi.updateCof(id, payload));
}

export function useForwardCofMutation(id: number) {
  return useCofMutation(() => cofsApi.forwardCof(id));
}

export function useSendCofForRevisionMutation(id: number) {
  return useCofMutation((reason: string) => cofsApi.sendCofForRevision(id, reason));
}

export function useCancelCofMutation(id: number) {
  return useCofMutation(() => cofsApi.cancelCof(id));
}

export function useConfirmCofCancellationMutation(id: number) {
  return useCofMutation(() => cofsApi.confirmCofCancellation(id));
}

export function useDeclineCofCancellationMutation(id: number) {
  return useCofMutation(() => cofsApi.declineCofCancellation(id));
}
