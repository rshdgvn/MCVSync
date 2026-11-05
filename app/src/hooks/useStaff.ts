import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as staffApi from "@/api/staff";
import type { Role } from "@/types/user";

export const branchesQueryKey = ["branches"] as const;
export const employeesQueryKey = ["employees"] as const;
export const rolesQueryKey = ["roles"] as const;
export const permissionsQueryKey = ["permissions"] as const;

export function useBranchesQuery(enabled = true) {
  return useQuery({ queryKey: branchesQueryKey, queryFn: staffApi.listBranches, enabled });
}

export function useEmployeesQuery() {
  return useQuery({ queryKey: employeesQueryKey, queryFn: staffApi.listEmployees });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.createEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: staffApi.UpdateEmployeePayload }) =>
      staffApi.updateEmployee(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}

export function useDeactivateEmployeeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}

export function useActivateEmployeeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.activateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}

export function useRolesQuery() {
  return useQuery({ queryKey: rolesQueryKey, queryFn: staffApi.listRoles });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: permissionsQueryKey, queryFn: staffApi.listPermissions });
}

export function useUpdateRolePermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ role, permissionIds }: { role: Role; permissionIds: number[] }) =>
      staffApi.updateRolePermissions(role, permissionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
  });
}

export function useAssignEmployeeRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: number; role: Role }) =>
      staffApi.assignEmployeeRole(employeeId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}
