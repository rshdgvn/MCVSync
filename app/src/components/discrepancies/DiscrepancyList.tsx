import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { ResolveDiscrepancyDialog } from "@/components/discrepancies/ResolveDiscrepancyDialog";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Discrepancy, DiscrepancyListResponse } from "@/types/discrepancy";

interface DiscrepancyListProps {
  query: UseQueryResult<DiscrepancyListResponse>;
  onPageChange: (page: number) => void;
  showDocument?: boolean;
  empty: { title: string; description?: string; action?: ReactNode };
}

function DocumentLink({ discrepancy }: { discrepancy: Discrepancy }) {
  const label = <span className="font-mono text-xs font-semibold">{discrepancy.reference_number ?? "—"}</span>;
  if (discrepancy.reference_type !== "purchase_order") {
    return label;
  }
  return (
    <Link
      to="/purchasing/purchase-orders/$purchaseOrderId"
      params={{ purchaseOrderId: String(discrepancy.reference_id) }}
      onClick={(event) => event.stopPropagation()}
      className="text-primary-hover hover:underline"
    >
      {label}
    </Link>
  );
}

function buildColumns(showDocument: boolean): DataListColumn<Discrepancy>[] {
  const columns: (DataListColumn<Discrepancy> | false)[] = [
    { key: "created_at", header: "Logged", mobile: "meta", cell: (row) => formatDateTime(row.created_at) },
    { key: "type", header: "Type", mobile: "badge", cell: (row) => <StatusBadge status={row.type} /> },
    showDocument && { key: "document", header: "Document", mobile: "subtitle", cell: (row) => <DocumentLink discrepancy={row} /> },
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: (row) => <span className="font-medium">{row.item?.name ?? "Unknown item"}</span>,
    },
    {
      key: "scanned_quantity",
      header: "Scanned Qty",
      align: "right",
      cell: (row) => <span className="font-mono">{formatNumber(row.scanned_quantity)}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      className: "max-w-64",
      cell: (row) => <span className="line-clamp-2 text-muted-foreground">{row.notes ?? "—"}</span>,
    },
    {
      key: "resolved",
      header: "Status",
      cell: (row) =>
        row.resolved ? (
          <span className="flex flex-col gap-0.5">
            <StatusBadge status="resolved" />
            <span className="text-xs text-muted-foreground">
              {row.resolved_by ?? "—"} · {formatDateTime(row.resolved_at)}
            </span>
            {row.resolution_note && <span className="line-clamp-2 text-xs text-foreground-soft">{row.resolution_note}</span>}
          </span>
        ) : (
          <StatusBadge status="unresolved" />
        ),
    },
  ];
  return columns.filter((column): column is DataListColumn<Discrepancy> => column !== false);
}

export function DiscrepancyList({ query, onPageChange, showDocument = true, empty }: DiscrepancyListProps) {
  const [resolving, setResolving] = useState<Discrepancy | null>(null);

  return (
    <>
      <DataList
        label="Discrepancies"
        columns={buildColumns(showDocument)}
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={5}
        empty={empty}
        rowActions={(row) =>
          row.resolved ? [] : [{ label: "Resolve", icon: CheckCircle2, onClick: () => setResolving(row) }]
        }
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={onPageChange} />}
      />
      {resolving && <ResolveDiscrepancyDialog key={resolving.id} discrepancy={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}
