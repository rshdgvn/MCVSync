import { listSuppliers } from "@/api/suppliers";
import { SearchCombobox } from "@/components/SearchCombobox";
import { supplierKeys } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/supplier";

interface SupplierComboboxProps {
  id?: string;
  value: Supplier | null;
  onChange: (supplier: Supplier) => void;
  placeholder?: string;
  invalid?: boolean;
  activeOnly?: boolean;
}

const supplierId = (supplier: Supplier) => supplier.id;
const supplierName = (supplier: Supplier) => supplier.name;

export function SupplierCombobox({
  id,
  value,
  onChange,
  placeholder = "Choose a supplier",
  invalid,
  activeOnly = true,
}: SupplierComboboxProps) {
  return (
    <SearchCombobox
      id={id}
      label="Supplier"
      placeholder={placeholder}
      invalid={invalid}
      value={value}
      onChange={onChange}
      getId={supplierId}
      getLabel={supplierName}
      search={(term) => {
        const params = { search: term || undefined, is_active: activeOnly || undefined };
        return { queryKey: supplierKeys.list(params), queryFn: () => listSuppliers(params) };
      }}
    />
  );
}
