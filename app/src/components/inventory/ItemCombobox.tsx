import { listItems } from "@/api/inventory";
import { listPricedItems } from "@/api/pricing";
import { SearchCombobox, type SearchQuery } from "@/components/SearchCombobox";
import { itemsQueryKey } from "@/hooks/useInventory";
import { pricingKeys } from "@/hooks/usePricing";
import type { Item } from "@/types/inventory";

export type ItemSource = "inventory" | "pricing";

interface ItemComboboxProps {
  id?: string;
  value: Item | null;
  onChange: (item: Item) => void;
  invalid?: boolean;
  disabled?: boolean;
  source?: ItemSource;
  placeholder?: string;
}

const itemId = (item: Item) => item.id;
const itemLabel = (item: Item) => `${item.name} · ${item.sku}`;

function itemSearch(source: ItemSource, term: string): SearchQuery<Item> {
  if (source === "pricing") {
    const params = { search: term || undefined };
    return { queryKey: pricingKeys.items(params), queryFn: () => listPricedItems(params) };
  }
  const params = { search: term || undefined, is_active: true };
  return { queryKey: itemsQueryKey(params), queryFn: () => listItems(params) };
}

export function ItemCombobox({
  id,
  value,
  onChange,
  invalid,
  disabled,
  source = "inventory",
  placeholder = "Search by name or SKU",
}: ItemComboboxProps) {
  return (
    <SearchCombobox
      id={id}
      label="Item"
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
      value={value}
      onChange={onChange}
      getId={itemId}
      getLabel={itemLabel}
      search={(term) => itemSearch(source, term)}
    />
  );
}
