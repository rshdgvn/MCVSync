import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import { AgingChip } from "@/components/AgingChip";
import { DataList, type DataListColumn } from "@/components/DataList";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { PICK_AGING_DANGER_DAYS, PICK_AGING_WARN_DAYS, waitingSince } from "@/components/issuing-stock/cofPickRules";
import { cofFulfillmentQueryOptions } from "@/hooks/useCofFulfillment";
import { daysSince, formatDate, formatNumber } from "@/lib/format";
import type { CofFulfillment } from "@/types/clientOrderForm";
import type { Paginated } from "@/types/inventory";

interface ClientOrderPickListProps {
  query: UseQueryResult<Paginated<CofFulfillment>>;
  showBranch: boolean;
  onPageChange: (page: number) => void;
  onOpen: (cof: CofFulfillment) => void;
}

function columnsFor(showBranch: boolean): DataListColumn<CofFulfillment>[] {
  return [
    {
      key: "cof_number",
      header: "COF #",
      mobile: "title",
      cell: (cof) => <span className="font-mono text-xs font-semibold text-primary-hover">{cof.cof_number}</span>,
    },
    { key: "client", header: "Client", mobile: "subtitle", cell: (cof) => <span className="font-medium">{cof.client_name}</span> },
    ...(showBranch ? [{ key: "branch", header: "Branch", cell: (cof: CofFulfillment) => cof.branch?.name }] : []),
    {
      key: "waiting",
      header: "Waiting",
      mobile: "badge",
      cell: (cof) => {
        const since = waitingSince(cof);
        const days = since ? daysSince(since) : 0;
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            {days > 0 ? (
              <AgingChip days={days} warnAt={PICK_AGING_WARN_DAYS} dangerAt={PICK_AGING_DANGER_DAYS} />
            ) : (
              <span className="text-xs text-muted-foreground">Today</span>
            )}
            {cof.cancellation_requested && <StatusBadge status="cancellation_requested" />}
          </span>
        );
      },
    },
    {
      key: "delivery",
      header: "Deliver By",
      mobile: "meta",
      cell: (cof) => (cof.request_delivery_date ? formatDate(cof.request_delivery_date) : "—"),
    },
    {
      key: "items_count",
      header: "Items",
      align: "right",
      cell: (cof) => <span className="font-mono">{formatNumber(cof.items_count ?? 0)}</span>,
    },
  ];
}

export function ClientOrderPickList({ query, showBranch, onPageChange, onOpen }: ClientOrderPickListProps) {
  const queryClient = useQueryClient();

  return (
    <DataList
      label="Client orders to pick"
      columns={columnsFor(showBranch)}
      rows={query.data?.data}
      rowKey={(cof) => cof.id}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      isRefreshing={query.isFetching && query.isPlaceholderData}
      skeletonRows={8}
      empty={{ title: "No client orders to pick", description: "Orders Sales forwards to Purchasing appear here, earliest delivery first." }}
      onRowClick={onOpen}
      onRowIntent={(cof) => void queryClient.prefetchQuery(cofFulfillmentQueryOptions(cof.id))}
      rowActions={(cof) => [{ label: "Pick", icon: PackageOpen, onClick: () => onOpen(cof) }]}
      footer={query.data && <Pagination meta={query.data.meta} onPageChange={onPageChange} />}
    />
  );
}
