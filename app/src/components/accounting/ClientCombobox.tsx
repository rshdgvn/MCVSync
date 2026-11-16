import { listPricingClients } from "@/api/pricing";
import { SearchCombobox } from "@/components/SearchCombobox";
import { pricingKeys } from "@/hooks/usePricing";
import type { Client } from "@/types/accounting";

interface ClientComboboxProps {
  id?: string;
  value: Client | null;
  onChange: (client: Client) => void;
  placeholder?: string;
  invalid?: boolean;
}

const clientId = (client: Client) => client.id;
const clientName = (client: Client) => client.name;

export function ClientCombobox({ id, value, onChange, placeholder = "Choose a client", invalid }: ClientComboboxProps) {
  return (
    <SearchCombobox
      id={id}
      label="Client"
      placeholder={placeholder}
      invalid={invalid}
      value={value}
      onChange={onChange}
      getId={clientId}
      getLabel={clientName}
      search={(term) => {
        const params = { search: term || undefined };
        return { queryKey: pricingKeys.clients(params), queryFn: () => listPricingClients(params) };
      }}
    />
  );
}
