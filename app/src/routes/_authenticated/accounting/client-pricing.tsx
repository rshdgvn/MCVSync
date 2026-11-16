import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, Plus, Tag } from "lucide-react";
import { ClientCombobox } from "@/components/accounting/ClientCombobox";
import { PriceHistoryDialog } from "@/components/accounting/PriceHistoryDialog";
import { SetPriceDialog } from "@/components/accounting/SetPriceDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { ItemCombobox } from "@/components/inventory/ItemCombobox";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { useCurrentPricesQuery } from "@/hooks/usePricing";
import { formatDate, formatMoney } from "@/lib/format";
import { ACCOUNTING_ROLES, canManageAccounting, requireRole } from "@/lib/rbac";
import type { Client, ClientItemPrice } from "@/types/accounting";
import type { Item } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/accounting/client-pricing")({
  beforeLoad: requireRole(...ACCOUNTING_ROLES),
  component: ClientPricingPage,
});

type PriceDialog = { mode: "set"; client?: Client; item?: Item } | { mode: "history"; client: Client; item: Item } | null;

const COLUMNS: DataListColumn<ClientItemPrice>[] = [
  { key: "client", header: "Client", mobile: "title", cell: (price) => <span className="font-medium">{price.client.name}</span> },
  { key: "zone", header: "Zone / Region", cell: (price) => price.client.zone?.name ?? "—" },
  {
    key: "item",
    header: "Item",
    mobile: "subtitle",
    cell: (price) => (
      <span className="flex flex-col">
        <span>{price.item.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{price.item.sku}</span>
      </span>
    ),
  },
  {
    key: "srp",
    header: "SRP",
    align: "right",
    mobile: "badge",
    cell: (price) => <span className="font-mono font-semibold">{formatMoney(price.srp)}</span>,
  },
  {
    key: "last_updated",
    header: "Last Updated",
    cell: (price) => (
      <span className="flex flex-col">
        <span>{formatDate(price.created_at)}</span>
        <span className="text-xs text-muted-foreground">{price.set_by}</span>
      </span>
    ),
  },
];

function ClientPricingPage() {
  const user = useMeQuery().data;
  const canWrite = user ? canManageAccounting(user) : false;
  const [page, setPage] = useState(1);
  const [client, setClient] = useState<Client | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [dialog, setDialog] = useState<PriceDialog>(null);
  const query = useCurrentPricesQuery({ page, client_id: client?.id, item_id: item?.id });
  const filterCount = (client ? 1 : 0) + (item ? 1 : 0);

  const setPriceButton = canWrite && (
    <Button onClick={() => setDialog({ mode: "set" })}>
      <Plus />
      Set Price
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Client Item Pricing"
        description="The current SRP each client pays per item. A client and item with no price yet needs pricing."
        primaryAction={setPriceButton}
      />

      <FilterBar
        activeFilterCount={filterCount}
        onClearFilters={() => {
          setClient(null);
          setItem(null);
          setPage(1);
        }}
      >
        <div className="w-full md:w-60">
          <ClientCombobox
            value={client}
            placeholder="All Clients"
            onChange={(next) => {
              setClient(next);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full md:w-60">
          <ItemCombobox
            source="pricing"
            placeholder="All Items"
            value={item}
            onChange={(next) => {
              setItem(next);
              setPage(1);
            }}
          />
        </div>
      </FilterBar>

      <DataList
        label="Client item prices"
        columns={COLUMNS}
        rows={query.data?.data}
        rowKey={(price) => price.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={8}
        empty={
          filterCount > 0
            ? { title: "No prices found", description: "This client or item hasn't been priced yet." }
            : { title: "No prices yet", description: "Set the first client price to start.", action: setPriceButton || undefined }
        }
        rowActions={(price) => [
          {
            label: "View History",
            icon: History,
            onClick: () => setDialog({ mode: "history", client: price.client, item: price.item }),
          },
          ...(canWrite
            ? [{ label: "Set New Price", icon: Tag, onClick: () => setDialog({ mode: "set", client: price.client, item: price.item }) }]
            : []),
        ]}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />

      {dialog?.mode === "set" && (
        <SetPriceDialog initialClient={dialog.client} initialItem={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.mode === "history" && (
        <PriceHistoryDialog client={dialog.client} item={dialog.item} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
