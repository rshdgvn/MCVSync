import { useMemo, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSuppliersQuery } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/supplier";

interface SupplierComboboxProps {
  id?: string;
  value: Supplier | null;
  onChange: (supplier: Supplier) => void;
  placeholder?: string;
  invalid?: boolean;
  activeOnly?: boolean;
}

export function SupplierCombobox({
  id,
  value,
  onChange,
  placeholder = "Choose a supplier",
  invalid,
  activeOnly = true,
}: SupplierComboboxProps) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const suppliersQuery = useSuppliersQuery({ search: search || undefined, is_active: activeOnly || undefined });
  const suppliers = suppliersQuery.data?.data;
  const byId = useMemo(() => new Map((suppliers ?? []).map((supplier) => [String(supplier.id), supplier])), [suppliers]);

  return (
    <Combobox
      id={id}
      label="Supplier"
      value={value ? String(value.id) : ""}
      valueLabel={value?.name}
      placeholder={placeholder}
      invalid={invalid}
      isLoading={suppliersQuery.isFetching}
      onQueryChange={setQuery}
      options={(suppliers ?? []).map((supplier) => ({ value: String(supplier.id), label: supplier.name }))}
      onChange={(next) => {
        const supplier = byId.get(next);
        if (supplier) {
          onChange(supplier);
        }
      }}
    />
  );
}
