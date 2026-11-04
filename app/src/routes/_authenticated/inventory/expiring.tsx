import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DataList, type DataListColumn } from "@/components/DataList";
import { ExpiryChip } from "@/components/ExpiryChip";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { itemQueryOptions, useExpiringAlertsQuery } from "@/hooks/useInventory";
import { formatNumber } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import type { Batch } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/inventory/expiring")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ExpiringItemsPage,
});

const COLUMNS: DataListColumn<Batch>[] = [
  {
    key: "item",
    header: "Item",
    mobile: "title",
    cell: (batch) => <span className="font-medium">{batch.item?.name ?? "—"}</span>,
  },
  {
    key: "batch",
    header: "Batch Number",
    mobile: "subtitle",
    cell: (batch) => <span className="font-mono text-xs text-muted-foreground">{batch.batch_number}</span>,
  },
  { key: "branch", header: "Branch", cell: (batch) => batch.branch?.name ?? "—" },
  {
    key: "quantity",
    header: "On Hand",
    align: "right",
    cell: (batch) => <span className="font-mono tabular-nums">{formatNumber(batch.quantity)}</span>,
  },
  {
    key: "expiry",
    header: "Expiry Date",
    mobile: "badge",
    cell: (batch) => (
      <ExpiryChip
        expiryDate={batch.expiry_date}
        thresholdDays={batch.item?.effective_expiry_alert_threshold_days ?? 0}
      />
    ),
  },
];

function ExpiringItemsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const alertsQuery = useExpiringAlertsQuery({ page });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Near-Expiry Items"
        description="Active batches expiring within their item's alert threshold, soonest first."
      />

      <DataList
        label="Near-expiry batches"
        columns={COLUMNS}
        rows={alertsQuery.data?.data}
        rowKey={(batch) => batch.id}
        isPending={alertsQuery.isPending}
        error={alertsQuery.error}
        onRetry={() => void alertsQuery.refetch()}
        isRefreshing={alertsQuery.isFetching && alertsQuery.isPlaceholderData}
        skeletonRows={8}
        empty={{ title: "Nothing near expiry", description: "Every active batch is outside its alert window." }}
        onRowClick={(batch) =>
          batch.item && void navigate({ to: "/items/$itemId", params: { itemId: String(batch.item.id) } })
        }
        onRowIntent={(batch) => batch.item && void queryClient.prefetchQuery(itemQueryOptions(batch.item.id))}
        footer={alertsQuery.data && <Pagination meta={alertsQuery.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
