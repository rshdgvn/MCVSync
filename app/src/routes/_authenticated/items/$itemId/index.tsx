import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailHeader } from "@/components/DetailHeader";
import { ErrorState } from "@/components/ErrorState";
import { ExpiryChip } from "@/components/ExpiryChip";
import { Pagination } from "@/components/Pagination";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { StockLevelBar } from "@/components/StockLevelBar";
import { TabBar } from "@/components/TabBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useItemBatchesQuery,
  useItemQuery,
  useItemStockQuery,
  useItemTransactionsQuery,
} from "@/hooks/useInventory";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { Batch, Item, ItemStockBreakdown, StockTransaction, StockTransactionType } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items/$itemId/")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemDetailPage,
});

type DetailTab = "batches" | "stock" | "transactions";

const TRANSACTION_LABEL: Record<StockTransactionType, string> = {
  receive: "Received",
  issue: "Picked",
  transfer_out: "Transfer Out",
  transfer_in: "Transfer In",
  adjustment: "Adjustment",
  reserve: "Reserved",
  release: "Released",
};

function sumStock(rows: ItemStockBreakdown[], key: "current" | "reserved" | "incoming" | "available"): number {
  return rows.reduce((total, row) => total + row[key], 0);
}

function ItemDetailPage() {
  const { itemId } = Route.useParams();
  const id = Number(itemId);
  const itemQuery = useItemQuery(id);
  const stockQuery = useItemStockQuery(id);
  const [tab, setTab] = useState<DetailTab>("batches");
  useInventoryChannels(stockQuery.data?.map((row) => row.branch_id) ?? []);

  if (itemQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-7 w-64" />
        <StatCardGrid>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </StatCardGrid>
      </div>
    );
  }

  if (itemQuery.isError) {
    return (
      <div className="border border-border bg-card">
        <ErrorState
          title="This item couldn't be loaded"
          message={getErrorMessage(itemQuery.error)}
          onRetry={() => void itemQuery.refetch()}
        />
      </div>
    );
  }

  const item = itemQuery.data;
  const unit = item.unit?.code;
  const stockRows = stockQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <DetailHeader
          backTo="/items"
          backLabel="Items"
          eyebrow="Inventory Item"
          title={item.name}
          meta={
            <>
              <span className="font-mono">{item.sku}</span>
              <span>{item.category?.name ?? "Uncategorized"}</span>
              <span>{item.unit?.name ?? "No unit"}</span>
              <StatusBadge status={item.is_active ? "active" : "inactive"} />
            </>
          }
          primaryAction={
            <Button render={<Link to="/items/$itemId/edit" params={{ itemId }} />}>
              <Pencil />
              Edit Item
            </Button>
          }
        />
      </div>

      <StatCardGrid>
        {stockRows ? (
          <>
            <StatCard label="On Hand" value={formatNumber(sumStock(stockRows, "current"))} sub={unit} />
            <StatCard label="Reserved" value={formatNumber(sumStock(stockRows, "reserved"))} sub={unit} />
            <StatCard label="Available" value={formatNumber(sumStock(stockRows, "available"))} sub={unit} />
            <StatCard label="Incoming" value={formatNumber(sumStock(stockRows, "incoming"))} sub={unit} />
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
      </StatCardGrid>

      <div className="flex flex-col gap-3">
        <TabBar
          ariaLabel="Item details"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "batches", label: "Batches" },
            { value: "stock", label: "Stock by Branch" },
            { value: "transactions", label: "Transactions" },
          ]}
        />
        {tab === "batches" && <BatchesTab item={item} />}
        {tab === "stock" && (
          <StockTab
            item={item}
            rows={stockRows}
            isPending={stockQuery.isPending}
            error={stockQuery.error}
            onRetry={() => void stockQuery.refetch()}
          />
        )}
        {tab === "transactions" && <TransactionsTab itemId={item.id} />}
      </div>
    </div>
  );
}

function BatchesTab({ item }: { item: Item }) {
  const [page, setPage] = useState(1);
  const batchesQuery = useItemBatchesQuery(item.id, page);

  const columns: DataListColumn<Batch>[] = [
    {
      key: "batch",
      header: "Batch Number",
      mobile: "title",
      cell: (batch) => <span className="font-mono text-xs">{batch.batch_number}</span>,
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
      cell: (batch) => (
        <ExpiryChip expiryDate={batch.expiry_date} thresholdDays={item.effective_expiry_alert_threshold_days} />
      ),
    },
    { key: "status", header: "Status", mobile: "badge", cell: (batch) => <StatusBadge status={batch.status} /> },
  ];

  return (
    <DataList
      label="Batches"
      columns={columns}
      rows={batchesQuery.data?.data}
      rowKey={(batch) => batch.id}
      isPending={batchesQuery.isPending}
      error={batchesQuery.error}
      onRetry={() => void batchesQuery.refetch()}
      isRefreshing={batchesQuery.isFetching && batchesQuery.isPlaceholderData}
      skeletonRows={4}
      empty={{ title: "No batches yet", description: "Batches appear here once stock is received." }}
      footer={batchesQuery.data && <Pagination meta={batchesQuery.data.meta} onPageChange={setPage} />}
    />
  );
}

interface StockTabProps {
  item: Item;
  rows: ItemStockBreakdown[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}

function StockTab({ item, rows, isPending, error, onRetry }: StockTabProps) {
  const columns: DataListColumn<ItemStockBreakdown>[] = [
    { key: "branch", header: "Branch", mobile: "title", cell: (row) => row.branch_name },
    { key: "current", header: "On Hand", align: "right", cell: (row) => formatNumber(row.current) },
    { key: "reserved", header: "Reserved", align: "right", cell: (row) => formatNumber(row.reserved) },
    { key: "incoming", header: "Incoming", align: "right", cell: (row) => formatNumber(row.incoming) },
    {
      key: "available",
      header: "Available",
      className: "w-44",
      cell: (row) => <StockLevelBar available={row.available} reorderPoint={item.reorder_point} />,
    },
  ];

  return (
    <DataList
      label="Stock by branch"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.branch_id}
      isPending={isPending}
      error={error}
      onRetry={onRetry}
      skeletonRows={3}
      empty={{ title: "No stock yet", description: "Stock appears here once it's received at a branch." }}
    />
  );
}

function TransactionsTab({ itemId }: { itemId: number }) {
  const [page, setPage] = useState(1);
  const transactionsQuery = useItemTransactionsQuery(itemId, page);

  const columns: DataListColumn<StockTransaction>[] = [
    {
      key: "type",
      header: "Type",
      mobile: "title",
      cell: (transaction) => TRANSACTION_LABEL[transaction.type],
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      mobile: "badge",
      cell: (transaction) => (
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            transaction.quantity < 0 ? "text-danger" : "text-success",
          )}
        >
          {transaction.quantity > 0 ? `+${formatNumber(transaction.quantity)}` : formatNumber(transaction.quantity)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      mobile: "subtitle",
      cell: (transaction) => formatDateTime(transaction.created_at),
    },
    { key: "branch", header: "Branch", cell: (transaction) => transaction.branch?.name ?? "—" },
    { key: "by", header: "Performed By", cell: (transaction) => transaction.performed_by ?? "—" },
  ];

  return (
    <DataList
      label="Stock transactions"
      columns={columns}
      rows={transactionsQuery.data?.data}
      rowKey={(transaction) => transaction.id}
      isPending={transactionsQuery.isPending}
      error={transactionsQuery.error}
      onRetry={() => void transactionsQuery.refetch()}
      isRefreshing={transactionsQuery.isFetching && transactionsQuery.isPlaceholderData}
      skeletonRows={5}
      empty={{ title: "No transactions yet", description: "Every stock movement for this item will be listed here." }}
      footer={transactionsQuery.data && <Pagination meta={transactionsQuery.data.meta} onPageChange={setPage} />}
    />
  );
}
