import type { ReactNode } from "react";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { transferStatusKey } from "@/api/transfers";
import { DataList, type DataListColumn } from "@/components/DataList";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { transferQueryOptions } from "@/hooks/useTransfers";
import { formatDate, formatNumber } from "@/lib/format";
import type { TransferListResponse, TransferSummary } from "@/types/transfer";

interface TransferListProps {
  query: UseQueryResult<TransferListResponse>;
  onPageChange: (page: number) => void;
  onOpen: (transfer: TransferSummary) => void;
  empty: { title: string; description?: string; action?: ReactNode };
}

const COLUMNS: DataListColumn<TransferSummary>[] = [
  {
    key: "transfer_number",
    header: "Transfer #",
    mobile: "title",
    cell: (transfer) => <span className="font-mono text-xs font-semibold text-primary-hover">{transfer.transfer_number}</span>,
  },
  { key: "requesting_branch", header: "Requesting Branch", mobile: "subtitle", cell: (transfer) => transfer.requesting_branch.name },
  { key: "fulfilling_branch", header: "Fulfilling Branch", cell: (transfer) => transfer.fulfilling_branch.name },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (transfer) => <StatusBadge status={transferStatusKey(transfer.status)} />,
  },
  {
    key: "items_count",
    header: "Items",
    align: "right",
    cell: (transfer) => <span className="font-mono">{formatNumber(transfer.items_count)}</span>,
  },
  { key: "created_at", header: "Created", cell: (transfer) => formatDate(transfer.created_at) },
];

export function TransferList({ query, onPageChange, onOpen, empty }: TransferListProps) {
  const queryClient = useQueryClient();

  return (
    <DataList
      label="Transfer Orders"
      columns={COLUMNS}
      rows={query.data?.data}
      rowKey={(transfer) => transfer.id}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      isRefreshing={query.isFetching && query.isPlaceholderData}
      skeletonRows={8}
      empty={empty}
      onRowClick={onOpen}
      onRowIntent={(transfer) => void queryClient.prefetchQuery(transferQueryOptions(transfer.id))}
      rowActions={(transfer) => [{ label: "View", icon: Eye, onClick: () => onOpen(transfer) }]}
      footer={query.data && <Pagination meta={query.data.meta} onPageChange={onPageChange} />}
    />
  );
}
