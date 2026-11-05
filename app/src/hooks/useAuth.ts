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
import { useActingAsStore } from "@/stores/actingAs.store";
import type { Role } from "@/types/user";

export const meQueryKey = ["auth", "me"] as const;

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: me,
  retry: false,
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}

export function useEffectiveRole(): Role | null {
  const role = useMeQuery().data?.role ?? null;
  const actingAs = useActingAsStore((state) => state.actingAs);
  return actingAs ?? role;
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
