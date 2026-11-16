import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { usePricedItemsQuery } from "@/hooks/usePricing";
import { formatMoney } from "@/lib/format";
import { ACCOUNTING_ROLES, requireRole } from "@/lib/rbac";
import type { ItemWithCogs } from "@/types/accounting";

export const Route = createFileRoute("/_authenticated/accounting/items")({
  beforeLoad: requireRole(...ACCOUNTING_ROLES),
  component: ItemsReferencePage,
});

const COLUMNS: DataListColumn<ItemWithCogs>[] = [
  { key: "name", header: "Item Name", mobile: "title", cell: (item) => <span className="font-medium">{item.name}</span> },
  {
    key: "sku",
    header: "SKU",
    mobile: "subtitle",
    cell: (item) => <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>,
  },
  { key: "category", header: "Category", cell: (item) => item.category?.name ?? "—" },
  { key: "unit", header: "Unit", cell: (item) => item.unit?.code ?? "—" },
  {
    key: "cogs",
    header: "COGS (Ref.)",
    align: "right",
    mobile: "badge",
    cell: (item) =>
      item.cogs === null ? (
        <span className="text-xs text-muted-foreground">Not purchased yet</span>
      ) : (
        <span className="font-mono font-semibold">{formatMoney(item.cogs)}</span>
      ),
  },
];

function ItemsReferencePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = usePricedItemsQuery({ page, search: search || undefined });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Items Reference"
        description="COGS is the unit cost on each item's most recent Purchase Order line. It is a reference for setting SRP."
      />
      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder="Search items…"
      />
      <DataList
        label="Items reference"
        columns={COLUMNS}
        rows={query.data?.data}
        rowKey={(item) => item.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={8}
        empty={
          search
            ? { title: "No items found", description: "Try a different item name." }
            : { title: "No items yet", description: "Items added by Purchasing appear here." }
        }
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
