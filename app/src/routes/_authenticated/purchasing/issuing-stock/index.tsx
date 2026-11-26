import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { ClientOrderPickList } from "@/components/issuing-stock/ClientOrderPickList";
import { TransferList } from "@/components/transfers/TransferList";
import { useMeQuery } from "@/hooks/useAuth";
import { useFulfillmentQueueQuery } from "@/hooks/useCofFulfillment";
import { useTransfersQuery } from "@/hooks/useTransfers";
import { INVENTORY_ACCESS_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";

type IssuingTab = "client_orders" | "transfers";

const ISSUING_TABS: readonly IssuingTab[] = ["client_orders", "transfers"];

export const Route = createFileRoute("/_authenticated/purchasing/issuing-stock/")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  validateSearch: (search: Record<string, unknown>): { tab?: IssuingTab } => ({
    tab: ISSUING_TABS.find((tab) => tab === search.tab),
  }),
  component: IssuingStockPage,
  errorComponent: RouteErrorFallback,
});

function IssuingStockPage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const allBranches = user ? seesAllBranches(user) : false;
  const fulfillsTransfers = user ? allBranches || Boolean(user.branch?.is_main) : false;
  const initialTab = Route.useSearch().tab;
  const [tab, setTab] = useState<IssuingTab>(initialTab === "transfers" && fulfillsTransfers ? "transfers" : "client_orders");
  const [cofPage, setCofPage] = useState(1);
  const [transferPage, setTransferPage] = useState(1);
  const [search, setSearch] = useState("");
  const showingTransfers = tab === "transfers";
  const cofQuery = useFulfillmentQueueQuery({ page: cofPage });
  const transfersQuery = useTransfersQuery(
    { page: transferPage, search: showingTransfers ? search || undefined : undefined, status: "pending" },
    fulfillsTransfers,
  );

  const tabs: FilterTab<IssuingTab>[] = [
    { value: "client_orders", label: "Client Orders", count: cofQuery.data?.meta.total },
    ...(fulfillsTransfers
      ? [{ value: "transfers" as const, label: "Transfers to Pick", count: transfersQuery.data?.counts.pending }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Issuing Stock" description="Pick stock for client orders and branch transfers, earliest delivery first." />

      <FilterTabs
        ariaLabel="Filter documents to pick"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setSearch("");
          setTransferPage(1);
        }}
        tabs={tabs}
      />

      {showingTransfers ? (
        <>
          <FilterBar
            search={search}
            onSearchChange={(next) => {
              setSearch(next);
              setTransferPage(1);
            }}
            searchPlaceholder="Search by Transfer# or branch…"
          />
          <TransferList
            query={transfersQuery}
            onPageChange={setTransferPage}
            onOpen={(transfer) =>
              void navigate({ to: "/purchasing/transfers/$transferId/pick", params: { transferId: String(transfer.id) } })
            }
            empty={
              search
                ? { title: "No transfers found", description: "Try a different Transfer# or branch." }
                : { title: "No transfers to pick", description: "Approved transfer requests appear here, ready to pick." }
            }
          />
        </>
      ) : (
        <ClientOrderPickList
          query={cofQuery}
          showBranch={allBranches}
          onPageChange={setCofPage}
          onOpen={(cof) =>
            void navigate({ to: "/purchasing/issuing-stock/client-orders/$cofId", params: { cofId: String(cof.id) } })
          }
        />
      )}
    </div>
  );
}
