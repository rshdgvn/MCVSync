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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.removeQueries({ queryKey: meQueryKey }),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: forgotPassword });
}

export function useResetPasswordMutation() {
  return useMutation({ mutationFn: resetPassword });
}
