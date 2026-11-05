import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as receivingApi from "@/api/receiving";
import { discrepancyKeys } from "@/hooks/useDiscrepancies";
import { purchaseOrderKeys } from "@/hooks/usePurchaseOrders";

export const receivingKeys = {
  all: ["receiving"] as const,
  session: (referenceType: receivingApi.ReceivingReferenceType, id: number) =>
    [...receivingKeys.all, referenceType, id] as const,
};

export function sessionHasItem(data: unknown, itemId: number): boolean {
  const session = data as receivingApi.ReceivingSession | undefined;
  return Boolean(session?.lines.some((line) => line.item.id === itemId));
}

function documentKeys(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const keys: Record<receivingApi.ReceivingReferenceType, readonly (readonly unknown[])[]> = {
    purchase_order: [purchaseOrderKeys.detail(id), purchaseOrderKeys.lists()],
  };
  return keys[referenceType];
}

function refreshAfterReceiving(
  queryClient: QueryClient,
  referenceType: receivingApi.ReceivingReferenceType,
  id: number,
  touchesDiscrepancies: boolean,
) {
  const keys = [receivingKeys.session(referenceType, id), ...documentKeys(referenceType, id)];
  if (touchesDiscrepancies) {
    keys.push(discrepancyKeys.lists());
  }
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useReceivingSessionQuery(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  return useQuery({
    queryKey: receivingKeys.session(referenceType, id),
    queryFn: () => receivingApi.getReceivingSession(referenceType, id),
    refetchOnWindowFocus: true,
  });
}

export function useMatchReceivingScanMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  return useMutation({
    mutationFn: (scan: { barcode: string } | { item_id: number }) => receivingApi.matchReceivingScan(referenceType, id, scan),
  });
}

export function useReceiveLineMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: receivingApi.ReceiveLinePayload) => receivingApi.receiveLine(referenceType, id, payload),
    onSuccess: (line) => refreshAfterReceiving(queryClient, referenceType, id, line.received > line.expected),
  });
}

export function useLogNotOnDocumentMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: receivingApi.NotOnDocumentPayload) => receivingApi.logNotOnDocument(referenceType, id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: receivingKeys.session(referenceType, id) }),
        queryClient.invalidateQueries({ queryKey: discrepancyKeys.lists() }),
      ]),
  });
}

export function useCompleteReceivingMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => receivingApi.completeReceiving(referenceType, id),
    onSuccess: () => refreshAfterReceiving(queryClient, referenceType, id, true),
  });
}
