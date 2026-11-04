import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  forgotPassword,
  login,
  logout,
  me,
  resetPassword,
} from "@/api/auth";
import { purgeUserData } from "@/pwa/userCache";

export const meQueryKey = ["auth", "me"] as const;

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: me,
  retry: false,
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: logout,
    onSuccess: () => purgeUserData(),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: forgotPassword });
}

export function useResetPasswordMutation() {
  return useMutation({ mutationFn: resetPassword });
}
