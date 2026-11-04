import { api } from "@/api/client";
import type { Supplier, SupplierListResponse } from "@/types/supplier";

export interface ListSuppliersParams {
  page?: number;
  search?: string;
  is_active?: boolean;
}

export interface SupplierPayload {
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export async function listSuppliers(params: ListSuppliersParams = {}): Promise<SupplierListResponse> {
  const response = await api.get<SupplierListResponse>("/staff/suppliers", { params });
  return response.data;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const response = await api.get<Supplier>(`/staff/suppliers/${id}`);
  return response.data;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const response = await api.post<Supplier>("/staff/suppliers", payload);
  return response.data;
}

export async function updateSupplier(id: number, payload: SupplierPayload): Promise<Supplier> {
  const response = await api.patch<Supplier>(`/staff/suppliers/${id}`, payload);
  return response.data;
}

export async function setSupplierActive(id: number, active: boolean): Promise<Supplier> {
  const action = active ? "activate" : "deactivate";
  const response = await api.post<Supplier>(`/staff/suppliers/${id}/${action}`);
  return response.data;
}
