import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { TransferList } from "@/components/transfers/TransferList";
import { useMeQuery } from "@/hooks/useAuth";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { useTransfersQuery } from "@/hooks/useTransfers";
import { INVENTORY_ACCESS_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";

type ReceivingTab = "ready_for_delivery" | "open" | "transfers";

const RECEIVING_TABS: readonly ReceivingTab[] = ["ready_for_delivery", "open", "transfers"];

export const Route = createFileRoute("/_authenticated/purchasing/stock-receiving/")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  validateSearch: (search: Record<string, unknown>): { tab?: ReceivingTab } => ({
    tab: RECEIVING_TABS.find((tab) => tab === search.tab),
  }),
  component: StockReceivingPage,
});

function StockReceivingPage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const receivesTransfers = user ? seesAllBranches(user) || (user.branch !== null && !user.branch.is_main) : false;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const initialTab = Route.useSearch().tab;
  const [tab, setTab] = useState<ReceivingTab>(
    initialTab === "transfers" && !receivesTransfers ? "ready_for_delivery" : (initialTab ?? "ready_for_delivery"),
  );
  const showingTransfers = tab === "transfers";
  const purchaseOrdersQuery = usePurchaseOrdersQuery({
    page: showingTransfers ? 1 : page,
    search: showingTransfers ? undefined : search || undefined,
    status: showingTransfers ? "ready_for_delivery" : tab,
  });
  const transfersQuery = useTransfersQuery(
    { page: showingTransfers ? page : 1, search: showingTransfers ? search || undefined : undefined, status: "shipped" },
    receivesTransfers,
  );
  const poCounts = purchaseOrdersQuery.data?.counts;

  const tabs: FilterTab<ReceivingTab>[] = [
    { value: "ready_for_delivery", label: "Ready for Delivery", count: poCounts?.ready_for_delivery },
    { value: "open", label: "Open", count: poCounts?.open },
    ...(receivesTransfers
      ? [{ value: "transfers" as const, label: "In Transit Transfers", count: transfersQuery.data?.counts.shipped }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stock Receiving" description="Select a Purchase Order or an incoming transfer to receive it." />

      <FilterTabs
        ariaLabel="Filter documents to receive"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
          setSearch("");
        }}
        tabs={tabs}
      />

      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder={showingTransfers ? "Search by Transfer# or branch…" : "Search by PO# or supplier…"}
      />

      {showingTransfers ? (
        <TransferList
          query={transfersQuery}
          onPageChange={setPage}
          onOpen={(transfer) =>
            void navigate({
              to: "/purchasing/stock-receiving/transfers/$transferId",
              params: { transferId: String(transfer.id) },
            })
          }
          empty={
            search
              ? { title: "No transfers found", description: "Try a different Transfer# or branch." }
              : { title: "Nothing in transit", description: "Transfers shipped to your branch appear here." }
          }
        />
      ) : (
        <PurchaseOrderList
          query={purchaseOrdersQuery}
          onPageChange={setPage}
          showBranch={user ? seesAllBranches(user) : false}
          onOpen={(po) =>
            void navigate({
              to: "/purchasing/stock-receiving/purchase-orders/$purchaseOrderId",
              params: { purchaseOrderId: String(po.id) },
            })
          }
          empty={
            search
              ? { title: "No purchase orders found", description: "Try a different PO# or supplier." }
              : {
                  title: tab === "ready_for_delivery" ? "Nothing ready to receive" : "No open purchase orders",
                  description: "Purchase Orders that can be received appear here.",
                }
          }
        />
      )}
    </div>
  );
}
