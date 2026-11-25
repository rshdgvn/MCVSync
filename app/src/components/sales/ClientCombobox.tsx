import { searchClients } from "@/api/salesCatalog";
import { SearchCombobox } from "@/components/SearchCombobox";
import { salesCatalogKeys } from "@/hooks/useClientOrderForms";
import type { ClientProfile } from "@/types/clientOrderForm";

interface ClientComboboxProps {
  id?: string;
  value: ClientProfile | null;
  onChange: (client: ClientProfile) => void;
  invalid?: boolean;
  disabled?: boolean;
}

const clientId = (client: ClientProfile) => client.id;
const clientName = (client: ClientProfile) => client.name;

export function ClientCombobox({ id, value, onChange, invalid, disabled }: ClientComboboxProps) {
  return (
    <SearchCombobox
      id={id}
      label="Client"
      placeholder="Choose a client"
      invalid={invalid}
      disabled={disabled}
      value={value}
      onChange={onChange}
      getId={clientId}
      getLabel={clientName}
      search={(term) => ({
        queryKey: salesCatalogKeys.clients(term),
        queryFn: () => searchClients({ search: term || undefined, per_page: 20 }),
      })}
    />
  );
}
