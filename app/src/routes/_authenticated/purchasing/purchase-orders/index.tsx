import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { SelectField } from "@/components/SelectField";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { SupplierCombobox } from "@/components/suppliers/SupplierCombobox";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { useBranchesQuery } from "@/hooks/useStaff";
import { formatNumber } from "@/lib/format";
import { PURCHASE_ORDER_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";
import { statusInfo } from "@/lib/status";
import { PURCHASE_ORDER_STATUSES } from "@/components/purchase-orders/purchaseOrderRules";
import type { PurchaseOrderStatus, PurchaseOrderStatusCounts } from "@/types/purchaseOrder";
import type { Supplier } from "@/types/supplier";

export const Route = createFileRoute("/_authenticated/purchasing/purchase-orders/")({
  beforeLoad: requireRole(...PURCHASE_ORDER_ROLES),
  component: PurchaseOrdersPage,
});

type StatusFilter = PurchaseOrderStatus | "all";

const ALL_BRANCHES = "all";

function statusTabs(counts: PurchaseOrderStatusCounts | undefined, selected: StatusFilter): FilterTab<StatusFilter>[] {
  const statusTabsShown = PURCHASE_ORDER_STATUSES.filter(
    (status) => status !== "draft" || selected === "draft" || (counts?.draft ?? 0) > 0,
  );
  return [
    { value: "all", label: "All POs", count: counts?.all },
    ...statusTabsShown.map((status) => ({ value: status, label: statusInfo(status).label, count: counts?.[status] })),
  ];
}

function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const showBranch = user ? seesAllBranches(user) : false;
  const branchesQuery = useBranchesQuery(showBranch);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [branchId, setBranchId] = useState(ALL_BRANCHES);

  const query = usePurchaseOrdersQuery({
    page,
    search: search || undefined,
    status: status === "all" ? undefined : status,
    supplier_id: supplier?.id,
    branch_id: branchId === ALL_BRANCHES ? undefined : Number(branchId),
  });
  const counts = query.data?.counts;
  const filterCount = (supplier ? 1 : 0) + (branchId === ALL_BRANCHES ? 0 : 1);

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const addButton = (
    <Button render={<Link to="/purchasing/purchase-orders/new" />}>
      <Plus />
      Add New PO
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        description="Orders sent to suppliers to restock a branch."
        primaryAction={addButton}
      />

      <StatCardGrid className="lg:grid-cols-3">
        {counts ? (
          <>
            <StatCard label="Awaiting Receipt" value={formatNumber(counts.open + counts.ready_for_delivery)} />
            <StatCard label="Received" value={formatNumber(counts.closed)} />
            <StatCard label="Total POs" value={formatNumber(counts.all)} />
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
      </StatCardGrid>

      <FilterTabs ariaLabel="Filter purchase orders by status" value={status} onChange={resetPage(setStatus)} tabs={statusTabs(counts, status)} />

      <FilterBar
        search={search}
        onSearchChange={resetPage(setSearch)}
        searchPlaceholder="Search by PO# or supplier…"
        activeFilterCount={filterCount}
        onClearFilters={() => {
          setSupplier(null);
          setBranchId(ALL_BRANCHES);
          setPage(1);
        }}
      >
        <div className="w-full md:w-56">
          <SupplierCombobox value={supplier} onChange={resetPage(setSupplier)} placeholder="All Suppliers" activeOnly={false} />
        </div>
        {showBranch && (
          <SelectField
            value={branchId}
            onChange={(value) => resetPage(setBranchId)(value || ALL_BRANCHES)}
            placeholder="Branch"
            triggerProps={{ className: "w-full md:w-44", "aria-label": "Branch" }}
            options={[
              { value: ALL_BRANCHES, label: "All Branches" },
              ...(branchesQuery.data ?? []).map((branch) => ({ value: String(branch.id), label: branch.name })),
            ]}
          />
        )}
      </FilterBar>

      <PurchaseOrderList
        query={query}
        onPageChange={setPage}
        showBranch={showBranch}
        onOpen={(po) =>
          void navigate({ to: "/purchasing/purchase-orders/$purchaseOrderId", params: { purchaseOrderId: String(po.id) } })
        }
        empty={
          search || status !== "all" || filterCount > 0
            ? { title: "No purchase orders found", description: "Try a different search, status, or filter." }
            : { title: "No purchase orders yet", description: "Create the first Purchase Order to restock this branch.", action: addButton }
        }
      />
    </div>
  );
}
