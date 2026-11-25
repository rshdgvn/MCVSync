import { searchSalesItems } from "@/api/salesCatalog";
import { SearchCombobox } from "@/components/SearchCombobox";
import { salesCatalogKeys } from "@/hooks/useClientOrderForms";
import type { SalesItem } from "@/types/clientOrderForm";

interface SalesItemComboboxProps {
  id?: string;
  value: SalesItem | null;
  onChange: (item: SalesItem) => void;
  invalid?: boolean;
}

const itemId = (item: SalesItem) => item.id;
const itemLabel = (item: SalesItem) => `${item.name} · ${item.sku}`;

export function SalesItemCombobox({ id, value, onChange, invalid }: SalesItemComboboxProps) {
  return (
    <SearchCombobox
      id={id}
      label="Item"
      placeholder="Search items by name or SKU"
      invalid={invalid}
      value={value}
      onChange={onChange}
      getId={itemId}
      getLabel={itemLabel}
      search={(term) => ({
        queryKey: salesCatalogKeys.items(term),
        queryFn: () => searchSalesItems({ search: term || undefined, per_page: 20 }),
      })}
    />
  );
}
