import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { SectionTitle } from "@/components/SectionTitle";
import { useMeQuery } from "@/hooks/useAuth";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { seesAllBranches } from "@/lib/rbac";
import type { Supplier } from "@/types/supplier";

interface SupplierPurchaseOrdersProps {
  supplier: Supplier;
}

export function SupplierPurchaseOrders({ supplier }: SupplierPurchaseOrdersProps) {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const [page, setPage] = useState(1);
  const query = usePurchaseOrdersQuery({ page, supplier_id: supplier.id });

  return (
    <div>
      <SectionTitle>Purchase Orders from {supplier.name}</SectionTitle>
      <PurchaseOrderList
        query={query}
        onPageChange={setPage}
        showSupplier={false}
        showBranch={user ? seesAllBranches(user) : false}
        onOpen={(po) =>
          void navigate({
            to: "/purchasing/purchase-orders/$purchaseOrderId",
            params: { purchaseOrderId: String(po.id) },
          })
        }
        empty={{ title: "No Purchase Orders yet", description: `Purchase Orders sent to ${supplier.name} will appear here.` }}
      />
    </div>
  );
}
