import type { Role } from "@/types/user";

export const SUPPLIER_ROUTES = {
  purchasing: { list: "/purchasing/suppliers", detail: "/purchasing/suppliers/$supplierId" },
  admin: { list: "/admin/suppliers", detail: "/admin/suppliers/$supplierId" },
} as const;

export type SupplierSection = keyof typeof SUPPLIER_ROUTES;

export function supplierSectionFor(role: Role | null): SupplierSection | null {
  return role === "purchasing" || role === "admin" ? role : null;
}
