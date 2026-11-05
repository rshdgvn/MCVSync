import { createFileRoute } from "@tanstack/react-router";
import { StockFlowSession } from "@/components/receiving/StockFlowSession";
import { PURCHASE_ORDER_ROLES, requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/stock-receiving/purchase-orders/$purchaseOrderId")({
  beforeLoad: requireRole(...PURCHASE_ORDER_ROLES),
  component: ReceivePurchaseOrderRoute,
});

function ReceivePurchaseOrderRoute() {
  const { purchaseOrderId } = Route.useParams();

  return (
    <StockFlowSession
      key={purchaseOrderId}
      referenceType="purchase_order"
      referenceId={Number(purchaseOrderId)}
      backTo="/purchasing/stock-receiving"
      backLabel="Stock Receiving"
      documentLabel="Purchase Order"
      documentLink={{ to: "/purchasing/purchase-orders/$purchaseOrderId", params: { purchaseOrderId } }}
    />
  );
}
