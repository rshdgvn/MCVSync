import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DataList, type DataListColumn } from "@/components/DataList";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StockLevelBar } from "@/components/StockLevelBar";
import { itemQueryOptions, useLowStockAlertsQuery } from "@/hooks/useInventory";
import { useInventoryChannels, usePurchasingOwnBranchIds } from "@/hooks/useInventoryChannels";
import { formatNumber } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import type { LowStockItem } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/inventory/low-stock")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: LowStockPage,
});

const COLUMNS: DataListColumn<LowStockItem>[] = [
  {
    key: "item",
    header: "Item",
    mobile: "title",
    cell: (row) => <span className="font-medium">{row.item_name}</span>,
  },
  {
    key: "sku",
    header: "SKU",
    mobile: "subtitle",
    cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.sku}</span>,
  },
  { key: "branch", header: "Branch", cell: (row) => row.branch_name },
  {
    key: "reorder",
    header: "Reorder Point",
    align: "right",
    cell: (row) => <span className="font-mono tabular-nums">{formatNumber(row.reorder_point)}</span>,
  },
  {
    key: "available",
    header: "Available",
    className: "w-44",
    cell: (row) => <StockLevelBar available={row.available} reorderPoint={row.reorder_point} />,
  },
];

function LowStockPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const alertsQuery = useLowStockAlertsQuery({ page });
  useInventoryChannels(usePurchasingOwnBranchIds());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Low Stock"
        description="Items whose available stock is at or below their reorder point."
      />

      <DataList
        label="Low stock items"
        columns={COLUMNS}
        rows={alertsQuery.data?.data}
        rowKey={(row) => `${row.item_id}-${row.branch_id}`}
        isPending={alertsQuery.isPending}
        error={alertsQuery.error}
        onRetry={() => void alertsQuery.refetch()}
        isRefreshing={alertsQuery.isFetching && alertsQuery.isPlaceholderData}
        skeletonRows={8}
        empty={{ title: "Nothing is low on stock", description: "Every item is above its reorder point." }}
        onRowClick={(row) => void navigate({ to: "/items/$itemId", params: { itemId: String(row.item_id) } })}
        onRowIntent={(row) => void queryClient.prefetchQuery(itemQueryOptions(row.item_id))}
        footer={alertsQuery.data && <Pagination meta={alertsQuery.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
