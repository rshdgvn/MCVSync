import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as suppliersApi from "@/api/suppliers";
import type { Supplier } from "@/types/supplier";

export const supplierKeys = {
  all: ["suppliers"] as const,
  lists: () => [...supplierKeys.all, "list"] as const,
  list: (params: suppliersApi.ListSuppliersParams) => [...supplierKeys.lists(), params] as const,
  detail: (id: number) => [...supplierKeys.all, "detail", id] as const,
};

export function useSuppliersQuery(params: suppliersApi.ListSuppliersParams) {
  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: () => suppliersApi.listSuppliers(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export const supplierQueryOptions = (id: number) =>
  queryOptions({ queryKey: supplierKeys.detail(id), queryFn: () => suppliersApi.getSupplier(id) });

export function useSupplierQuery(id: number) {
  return useQuery(supplierQueryOptions(id));
}

function storeSavedSupplier(queryClient: QueryClient, supplier: Supplier) {
  queryClient.setQueryData(supplierKeys.detail(supplier.id), supplier);
  return queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
}

export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: suppliersApi.createSupplier,
    onSuccess: (supplier) => storeSavedSupplier(queryClient, supplier),
  });
}

export function useUpdateSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: suppliersApi.SupplierPayload }) =>
      suppliersApi.updateSupplier(id, payload),
    onSuccess: (supplier) => storeSavedSupplier(queryClient, supplier),
  });
}

export function useSetSupplierActiveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => suppliersApi.setSupplierActive(id, active),
    onSuccess: (supplier) => storeSavedSupplier(queryClient, supplier),
  });
}
