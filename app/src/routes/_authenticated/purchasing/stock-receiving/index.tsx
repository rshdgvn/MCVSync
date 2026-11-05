import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { useMeQuery } from "@/hooks/useAuth";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { PURCHASE_ORDER_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/stock-receiving/")({
  beforeLoad: requireRole(...PURCHASE_ORDER_ROLES),
  component: StockReceivingPage,
});

type ReceivableStatus = "ready_for_delivery" | "open";

function StockReceivingPage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReceivableStatus>("ready_for_delivery");
  const query = usePurchaseOrdersQuery({ page, search: search || undefined, status });
  const counts = query.data?.counts;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stock Receiving" description="Select a Purchase Order to receive its delivery." />

      <FilterTabs
        ariaLabel="Filter receivable purchase orders"
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        tabs={[
          { value: "ready_for_delivery", label: "Ready for Delivery", count: counts?.ready_for_delivery },
          { value: "open", label: "Open", count: counts?.open },
        ]}
      />

      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder="Search by PO# or supplier…"
      />

      <PurchaseOrderList
        query={query}
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
                title: status === "ready_for_delivery" ? "Nothing ready to receive" : "No open purchase orders",
                description: "Purchase Orders that can be received appear here.",
              }
        }
      />
    </div>
  );
}
