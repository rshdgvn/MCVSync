import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as paymentsApi from "@/api/payments";

export const paymentKeys = {
  all: ["payments"] as const,
  pending: (params: paymentsApi.ListPaymentsParams) => [...paymentKeys.all, "pending", params] as const,
  history: (params: paymentsApi.ListPaymentsParams) => [...paymentKeys.all, "history", params] as const,
};

export function usePendingPaymentsQuery(params: paymentsApi.ListPaymentsParams) {
  return useQuery({
    queryKey: paymentKeys.pending(params),
    queryFn: () => paymentsApi.listPendingPayments(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function usePaymentHistoryQuery(params: paymentsApi.ListPaymentsParams) {
  return useQuery({
    queryKey: paymentKeys.history(params),
    queryFn: () => paymentsApi.listPaymentHistory(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useApprovePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: paymentsApi.ApprovePaymentPayload }) =>
      paymentsApi.approvePayment(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
