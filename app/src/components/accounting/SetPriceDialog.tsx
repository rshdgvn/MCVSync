import { useState, type ReactNode } from "react";
import { ClientCombobox } from "@/components/accounting/ClientCombobox";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { ItemCombobox } from "@/components/inventory/ItemCombobox";
import { LoadingButton } from "@/components/LoadingButton";
import { MicroLabel } from "@/components/MicroLabel";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentPricesQuery, useSetPriceMutation, useZoneAverageQuery } from "@/hooks/usePricing";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "@/stores/toast.store";
import type { Client } from "@/types/accounting";
import type { Item } from "@/types/inventory";

const PRICE_FIELDS = ["client_id", "item_id", "srp"] as const;

interface SetPriceDialogProps {
  initialClient?: Client;
  initialItem?: Item;
  onClose: () => void;
}

function Hint({ label, children, loading }: { label: string; children: ReactNode; loading?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <MicroLabel>{label}</MicroLabel>
      {loading ? <Skeleton className="h-5 w-32" /> : <div className="text-sm text-foreground md:text-ui">{children}</div>}
    </div>
  );
}

export function SetPriceDialog({ initialClient, initialItem, onClose }: SetPriceDialogProps) {
  const mutation = useSetPriceMutation();
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [item, setItem] = useState<Item | null>(initialItem ?? null);
  const [srp, setSrp] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const bothChosen = client !== null && item !== null;
  const currentQuery = useCurrentPricesQuery({ client_id: client?.id, item_id: item?.id, per_page: 1 }, bothChosen);
  const zoneAverageQuery = useZoneAverageQuery(item?.id ?? null, client?.zone?.id ?? null);
  const current = bothChosen ? (currentQuery.data?.data[0] ?? null) : null;
  const fieldErrors: Record<string, string> = { ...getFieldErrors(mutation.error), ...clientErrors };

  function handleSubmit() {
    const value = Number(srp);
    const errors: Record<string, string> = {};
    if (!client) {
      errors.client_id = "Choose a client.";
    }
    if (!item) {
      errors.item_id = "Choose an item.";
    }
    if (srp.trim() === "" || !Number.isFinite(value) || value < 0) {
      errors.srp = "Enter an SRP of 0 or more.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !client || !item) {
      return;
    }
    return mutation.mutateAsync(
      { client_id: client.id, item_id: item.id, srp: value },
      {
        onSuccess: () => {
          toast.success(`${formatMoney(value)} saved for ${client.name} · ${item.name}.`);
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Set Price"
      description="Saving always adds a new price. Earlier prices stay in the history."
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="set-price-form" isPending={mutation.isPending} pendingText="Saving…">
            Save Price
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="set-price-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, PRICE_FIELDS)} />
        <FormField label="Client" htmlFor="price-client" required error={fieldErrors.client_id}>
          <ClientCombobox
            id="price-client"
            value={client}
            invalid={Boolean(fieldErrors.client_id)}
            onChange={(next) => {
              setClient(next);
              setClientErrors(({ client_id: _removed, ...rest }) => rest);
            }}
          />
        </FormField>
        <FormField label="Item" htmlFor="price-item" required error={fieldErrors.item_id}>
          <ItemCombobox
            id="price-item"
            source="pricing"
            value={item}
            invalid={Boolean(fieldErrors.item_id)}
            onChange={(next) => {
              setItem(next);
              setClientErrors(({ item_id: _removed, ...rest }) => rest);
            }}
          />
        </FormField>

        {bothChosen && (
          <div className="grid gap-3 border border-border-subtle bg-subtle px-3 py-2.5 sm:grid-cols-3">
            <Hint label="Current Price" loading={currentQuery.isPending}>
              {current ? (
                <>
                  <span className="font-mono font-semibold">{formatMoney(current.srp)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(current.created_at)} · {current.set_by}
                  </span>
                </>
              ) : (
                <span className="text-warning">Needs pricing</span>
              )}
            </Hint>
            <Hint label="Zone Average (Reference Only)" loading={zoneAverageQuery.isFetching && zoneAverageQuery.isPending}>
              {client?.zone === null ? (
                <span className="text-muted-foreground">Client has no zone</span>
              ) : zoneAverageQuery.data === null || zoneAverageQuery.data === undefined ? (
                <span className="text-muted-foreground">No prices in {client?.zone?.name} yet</span>
              ) : (
                <>
                  <span className="font-mono font-semibold">{formatMoney(zoneAverageQuery.data)}</span>
                  <span className="block text-xs text-muted-foreground">{client?.zone?.name}</span>
                </>
              )}
            </Hint>
            <Hint label="COGS (Ref.)">
              {item?.cogs === null || item?.cogs === undefined ? (
                <span className="text-muted-foreground">Not purchased yet</span>
              ) : (
                <span className="font-mono font-semibold">{formatMoney(item.cogs)}</span>
              )}
            </Hint>
          </div>
        )}

        <FormField label="SRP (₱)" htmlFor="price-srp" required error={fieldErrors.srp}>
          <Input
            {...fieldA11yProps("price-srp", fieldErrors.srp)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="e.g. 250"
            className="font-mono md:w-40"
            value={srp}
            onChange={(event) => setSrp(event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
