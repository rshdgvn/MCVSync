import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/Combobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Paginated } from "@/types/inventory";

export interface SearchQuery<TOption> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<Paginated<TOption>>;
}

interface SearchComboboxProps<TOption> {
  id?: string;
  label: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  value: TOption | null;
  onChange: (option: TOption) => void;
  search: (term: string) => SearchQuery<TOption>;
  getId: (option: TOption) => number;
  getLabel: (option: TOption) => string;
}

export function SearchCombobox<TOption>({
  id,
  label,
  placeholder,
  invalid,
  disabled,
  value,
  onChange,
  search,
  getId,
  getLabel,
}: SearchComboboxProps<TOption>) {
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim());
  const result = useQuery({ ...search(term), placeholderData: keepPreviousData });
  const options = result.data?.data;
  const byId = useMemo(() => new Map((options ?? []).map((option) => [String(getId(option)), option])), [options, getId]);

  return (
    <Combobox
      id={id}
      label={label}
      value={value ? String(getId(value)) : ""}
      valueLabel={value ? getLabel(value) : undefined}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
      isLoading={result.isFetching}
      onQueryChange={setQuery}
      options={(options ?? []).map((option) => ({ value: String(getId(option)), label: getLabel(option) }))}
      onChange={(next) => {
        const option = byId.get(next);
        if (option) {
          onChange(option);
        }
      }}
    />
  );
}
