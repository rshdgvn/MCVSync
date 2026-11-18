import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { SelectField } from "@/components/SelectField";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { TransferList } from "@/components/transfers/TransferList";
import { canRequestTransfer } from "@/components/transfers/transferRules";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { useBranchesQuery } from "@/hooks/useStaff";
import { useTransfersQuery } from "@/hooks/useTransfers";
import { formatNumber } from "@/lib/format";
import { INVENTORY_ACCESS_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";
import type { TransferStatus, TransferStatusCounts } from "@/types/transfer";
import type { User } from "@/types/user";

export const Route = createFileRoute("/_authenticated/purchasing/transfers/")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: TransfersPage,
});

type TransferTab = "all" | "mine" | "to_approve" | "to_fulfill" | "shipped";

const TAB_STATUS: Record<TransferTab, TransferStatus | undefined> = {
  all: undefined,
  mine: undefined,
  to_approve: "awaiting_approval",
  to_fulfill: "pending",
  shipped: "shipped",
};

const ALL_BRANCHES = "all";

function tabsFor(user: User, counts: TransferStatusCounts | undefined): FilterTab<TransferTab>[] {
  if (seesAllBranches(user)) {
    return [{ value: "all", label: "All", count: counts?.all }];
  }
  if (user.branch?.is_main) {
    return [
      { value: "to_approve", label: "To Approve", count: counts?.awaiting_approval },
      { value: "to_fulfill", label: "To Fulfill", count: counts?.pending },
      { value: "shipped", label: "Shipped", count: counts?.shipped },
    ];
  }
  return [{ value: "mine", label: "My Requests", count: counts?.all }];
}

function TransfersPage() {
  const user = useMeQuery().data;
  if (!user) {
    return null;
  }
  return <TransfersPageContent user={user} />;
}

function TransfersPageContent({ user }: { user: User }) {
  const navigate = useNavigate();
  const showBranchFilter = seesAllBranches(user);
  const branchesQuery = useBranchesQuery(showBranchFilter);
  const [tab, setTab] = useState<TransferTab>(() => tabsFor(user, undefined)[0].value);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const query = useTransfersQuery({
    page,
    search: search || undefined,
    status: TAB_STATUS[tab],
    requesting_branch_id: branchId === ALL_BRANCHES ? undefined : Number(branchId),
  });
  const counts = query.data?.counts;
  const canRequest = canRequestTransfer(user);

  const newRequestButton = canRequest && (
    <Button render={<Link to="/purchasing/transfers/new" />}>
      <Plus />
      New Transfer Request
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Transfer Orders"
        description="Stock moved from the main branch to the other branches."
        primaryAction={newRequestButton}
      />

      <StatCardGrid className="lg:grid-cols-5">
        {counts ? (
          <>
            <StatCard label="Awaiting Approval" value={formatNumber(counts.awaiting_approval)} />
            <StatCard label="To Fulfill" value={formatNumber(counts.pending)} />
            <StatCard label="In Transit" value={formatNumber(counts.shipped)} />
            <StatCard label="Received / Closed" value={formatNumber(counts.closed)} />
            <StatCard label="Total" value={formatNumber(counts.all)} />
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
      </StatCardGrid>

      <FilterTabs
        ariaLabel="Filter transfer orders"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        tabs={tabsFor(user, counts)}
      />

      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder="Search by Transfer# or branch…"
        activeFilterCount={branchId === ALL_BRANCHES ? 0 : 1}
        onClearFilters={() => {
          setBranchId(ALL_BRANCHES);
          setPage(1);
        }}
      >
        {showBranchFilter && (
          <SelectField
            value={branchId}
            onChange={(value) => {
              setBranchId(value || ALL_BRANCHES);
              setPage(1);
            }}
            placeholder="Requesting Branch"
            triggerProps={{ className: "w-full md:w-52", "aria-label": "Requesting branch" }}
            options={[
              { value: ALL_BRANCHES, label: "All Requesting Branches" },
              ...(branchesQuery.data ?? [])
                .filter((branch) => !branch.is_main)
                .map((branch) => ({ value: String(branch.id), label: branch.name })),
            ]}
          />
        )}
      </FilterBar>

      <TransferList
        query={query}
        onPageChange={setPage}
        onOpen={(transfer) =>
          void navigate({ to: "/purchasing/transfers/$transferId", params: { transferId: String(transfer.id) } })
        }
        empty={
          search
            ? { title: "No transfers found", description: "Try a different Transfer# or branch." }
            : tab === "to_approve"
              ? { title: "Nothing to approve", description: "New requests from other branches wait here for approval." }
              : tab === "to_fulfill"
                ? { title: "Nothing to fulfill", description: "Approved requests appear here, ready to pick." }
                : { title: "No transfer requests yet", description: "Requests between branches appear here.", action: newRequestButton || undefined }
        }
      />
    </div>
  );
}
