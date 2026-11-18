import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as receivingApi from "@/api/receiving";
import { useMeQuery } from "@/hooks/useAuth";
import { discrepancyKeys } from "@/hooks/useDiscrepancies";
import { purchaseOrderKeys } from "@/hooks/usePurchaseOrders";
import { transferKeys } from "@/hooks/useTransfers";
import { requireUserId } from "@/lib/offline/sendOrQueue";

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
    transfer_request: [transferKeys.detail(id), transferKeys.lists()],
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
    networkMode: "offlineFirst",
  });
}

export function useMatchReceivingScanMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  return useMutation({
    mutationFn: (scan: { barcode: string } | { item_id: number }) => receivingApi.matchReceivingScan(referenceType, id, scan),
  });
}

export function useReceiveLineMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const queryClient = useQueryClient();
  const userId = useMeQuery().data?.id;

  return useMutation({
    mutationFn: ({ payload, label }: { payload: receivingApi.ReceiveLinePayload; label: string }) =>
      receivingApi.receiveLine(requireUserId(userId), referenceType, id, payload, label),
    onSuccess: (outcome) =>
      outcome.queued ? undefined : refreshAfterReceiving(queryClient, referenceType, id, outcome.data.done > outcome.data.target),
  });
}

export function useLogNotOnDocumentMutation(referenceType: receivingApi.ReceivingReferenceType, id: number) {
  const queryClient = useQueryClient();
  const userId = useMeQuery().data?.id;

  return useMutation({
    mutationFn: ({ payload, label }: { payload: receivingApi.NotOnDocumentPayload; label: string }) =>
      receivingApi.logNotOnDocument(requireUserId(userId), referenceType, id, payload, label),
    onSuccess: (outcome) =>
      outcome.queued
        ? undefined
        : Promise.all([
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
