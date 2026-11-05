import type { ReactNode } from "react";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { purchaseOrderQueryOptions } from "@/hooks/usePurchaseOrders";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { PurchaseOrderListResponse, PurchaseOrderSummary } from "@/types/purchaseOrder";

interface PurchaseOrderListProps {
  query: UseQueryResult<PurchaseOrderListResponse>;
  onPageChange: (page: number) => void;
  onOpen?: (purchaseOrder: PurchaseOrderSummary) => void;
  showSupplier?: boolean;
  showBranch?: boolean;
  empty: { title: string; description?: string; action?: ReactNode };
}

function buildColumns(showSupplier: boolean, showBranch: boolean): DataListColumn<PurchaseOrderSummary>[] {
  const columns: (DataListColumn<PurchaseOrderSummary> | false)[] = [
    { key: "order_date", header: "Date", mobile: "meta", cell: (po) => formatDate(po.order_date) },
    {
      key: "po_number",
      header: "PO #",
      mobile: "title",
      cell: (po) => <span className="font-mono text-xs font-semibold text-primary-hover">{po.po_number}</span>,
    },
    showSupplier && { key: "supplier", header: "Supplier Name", mobile: "subtitle", cell: (po) => po.supplier.name },
    showBranch && { key: "branch", header: "Branch", cell: (po) => po.branch.name },
    {
      key: "request_delivery_date",
      header: "Expected Delivery",
      cell: (po) => formatDate(po.request_delivery_date),
    },
    { key: "status", header: "Status", mobile: "badge", cell: (po) => <StatusBadge status={po.status} /> },
    {
      key: "items_count",
      header: "Items",
      align: "right",
      mobile: "hidden",
      cell: (po) => <span className="font-mono">{formatNumber(po.items_count)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (po) => <span className="font-mono font-semibold">{formatMoney(po.total)}</span>,
    },
  ];
  return columns.filter((column): column is DataListColumn<PurchaseOrderSummary> => column !== false);
}

export function PurchaseOrderList({
  query,
  onPageChange,
  onOpen,
  showSupplier = true,
  showBranch = false,
  empty,
}: PurchaseOrderListProps) {
  const queryClient = useQueryClient();

  return (
    <DataList
      label="Purchase Orders"
      columns={buildColumns(showSupplier, showBranch)}
      rows={query.data?.data}
      rowKey={(po) => po.id}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      isRefreshing={query.isFetching && query.isPlaceholderData}
      skeletonRows={8}
      empty={empty}
      onRowClick={onOpen}
      onRowIntent={onOpen && ((po) => void queryClient.prefetchQuery(purchaseOrderQueryOptions(po.id)))}
      rowActions={onOpen && ((po) => [{ label: "View", icon: Eye, onClick: () => onOpen(po) }])}
      footer={query.data && <Pagination meta={query.data.meta} onPageChange={onPageChange} />}
    />
  );
}
