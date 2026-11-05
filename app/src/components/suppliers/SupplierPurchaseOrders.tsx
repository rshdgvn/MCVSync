import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { SectionTitle } from "@/components/SectionTitle";
import type { SupplierSection } from "@/components/suppliers/supplierRoutes";
import { useMeQuery } from "@/hooks/useAuth";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { seesAllBranches } from "@/lib/rbac";
import type { Supplier } from "@/types/supplier";

interface SupplierPurchaseOrdersProps {
  supplier: Supplier;
  section: SupplierSection;
}

export function SupplierPurchaseOrders({ supplier, section }: SupplierPurchaseOrdersProps) {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const [page, setPage] = useState(1);
  const query = usePurchaseOrdersQuery({ page, supplier_id: supplier.id });
  const canOpenOrders = section === "purchasing";

  return (
    <div>
      <SectionTitle>Purchase Orders from {supplier.name}</SectionTitle>
      <PurchaseOrderList
        query={query}
        onPageChange={setPage}
        showSupplier={false}
        showBranch={user ? seesAllBranches(user) : false}
        onOpen={
          canOpenOrders
            ? (po) =>
                void navigate({
                  to: "/purchasing/purchase-orders/$purchaseOrderId",
                  params: { purchaseOrderId: String(po.id) },
                })
            : undefined
        }
        empty={{ title: "No Purchase Orders yet", description: `Purchase Orders sent to ${supplier.name} will appear here.` }}
      />
    </div>
  );
}
