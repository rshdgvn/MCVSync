import type { ActiveStatusCounts, Paginated } from "@/types/inventory";

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

export interface SupplierListResponse extends Paginated<Supplier> {
  counts: ActiveStatusCounts;
}
