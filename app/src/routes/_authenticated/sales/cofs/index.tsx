import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { COF_PERMISSIONS, hasPermission, isBilled } from "@/components/sales/cofRules";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { cofQueryOptions, useCofsQuery } from "@/hooks/useClientOrderForms";
import { formatDate, formatMoney } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { statusInfo } from "@/lib/status";
import type { CofStatus, CofStatusCounts, CofSummary } from "@/types/clientOrderForm";

const STATUSES: readonly CofStatus[] = [
  "pending_approval",
  "needs_revision",
  "processing",
  "ready_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

type StatusFilter = CofStatus | "all";

export const Route = createFileRoute("/_authenticated/sales/cofs/")({
  beforeLoad: requireRole("sales", "accounting", "admin", "super_admin"),
  validateSearch: (search: Record<string, unknown>): { status?: CofStatus } => ({
    status: STATUSES.find((status) => status === search.status),
  }),
  component: CofListPage,
  errorComponent: RouteErrorFallback,
});

function statusTabs(counts: CofStatusCounts | undefined): FilterTab<StatusFilter>[] {
  return [
    { value: "all", label: "All COFs", count: counts?.all },
    ...STATUSES.map((status) => ({ value: status, label: statusInfo(status).label, count: counts?.[status] })),
  ];
}

function CofListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useMeQuery().data;
  const status: StatusFilter = Route.useSearch().status ?? "all";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useCofsQuery({ page, search: search || undefined, status: status === "all" ? undefined : status });

  function open(cof: CofSummary) {
    void navigate({ to: "/sales/cofs/$cofId", params: { cofId: String(cof.id) } });
  }

  const columns: DataListColumn<CofSummary>[] = [
    { key: "date", header: "Date", mobile: "meta", cell: (cof) => formatDate(cof.created_at) },
    {
      key: "cof_number",
      header: "COF #",
      mobile: "title",
      cell: (cof) => <span className="font-mono text-xs font-semibold text-primary-hover">{cof.cof_number}</span>,
    },
    { key: "client", header: "Client", mobile: "subtitle", cell: (cof) => cof.client?.name },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (cof) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={cof.order_status} />
          {cof.cancellation_requested && <StatusBadge status="cancellation_requested" />}
        </span>
      ),
    },
    { key: "source", header: "Source", mobile: "hidden", cell: (cof) => <StatusBadge status={cof.source_type} /> },
    { key: "terms", header: "Terms", mobile: "meta", cell: (cof) => cof.terms ?? "—" },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (cof) => <span className="font-mono font-semibold">{isBilled(cof.order_status) ? formatMoney(cof.total) : "—"}</span>,
    },
  ];

  const newButton = hasPermission(user, COF_PERMISSIONS.create) && (
    <Button render={<Link to="/sales/cofs/new" />}>
      <Plus />
      New COF
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Client Order Forms" description="Every order from clients, from intake to delivery." primaryAction={newButton} />

      <FilterTabs
        ariaLabel="Filter COFs by status"
        value={status}
        onChange={(next) => {
          setPage(1);
          void navigate({ to: ".", search: next === "all" ? {} : { status: next }, replace: true });
        }}
        tabs={statusTabs(query.data?.counts)}
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by COF # or client…"
        activeFilterCount={0}
        onClearFilters={() => undefined}
      />

      <DataList
        label="Client Order Forms"
        columns={columns}
        rows={query.data?.data}
        rowKey={(cof) => cof.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={8}
        empty={
          search || status !== "all"
            ? { title: "No COFs found", description: "Try a different search or status." }
            : { title: "No Client Order Forms yet", description: "Portal orders and logged messages become COFs here.", action: newButton || undefined }
        }
        onRowClick={open}
        onRowIntent={(cof) => void queryClient.prefetchQuery(cofQueryOptions(cof.id))}
        rowActions={(cof) => [{ label: "View", icon: Eye, onClick: () => open(cof) }]}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
