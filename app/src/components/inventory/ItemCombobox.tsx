import { useMemo, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItemsQuery } from "@/hooks/useInventory";
import type { Item } from "@/types/inventory";

interface ItemComboboxProps {
  id?: string;
  value: Item | null;
  onChange: (item: Item) => void;
  invalid?: boolean;
  disabled?: boolean;
}

function itemLabel(item: Item): string {
  return `${item.name} · ${item.sku}`;
}

export function ItemCombobox({ id, value, onChange, invalid, disabled }: ItemComboboxProps) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const itemsQuery = useItemsQuery({ search: search || undefined, is_active: true });
  const items = itemsQuery.data?.data;
  const byId = useMemo(() => new Map((items ?? []).map((item) => [String(item.id), item])), [items]);

  return (
    <Combobox
      id={id}
      label="Item"
      value={value ? String(value.id) : ""}
      valueLabel={value ? itemLabel(value) : undefined}
      placeholder="Search by name or SKU"
      invalid={invalid}
      disabled={disabled}
      isLoading={itemsQuery.isFetching}
      onQueryChange={setQuery}
      options={(items ?? []).map((item) => ({ value: String(item.id), label: itemLabel(item) }))}
      onChange={(next) => {
        const item = byId.get(next);
        if (item) {
          onChange(item);
        }
      }}
    />
  );
}
