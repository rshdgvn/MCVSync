export const SUPPLIER_ROUTES = {
  purchasing: { list: "/purchasing/suppliers", detail: "/purchasing/suppliers/$supplierId" },
  admin: { list: "/admin/suppliers", detail: "/admin/suppliers/$supplierId" },
} as const;

export type SupplierSection = keyof typeof SUPPLIER_ROUTES;
