import { createFileRoute } from "@tanstack/react-router";
import { ReceivingSession } from "@/components/receiving/ReceivingSession";
import { INVENTORY_ACCESS_ROLES, requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/stock-receiving/transfers/$transferId")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: ReceiveTransferRoute,
});

function ReceiveTransferRoute() {
  const { transferId } = Route.useParams();

  return (
    <ReceivingSession
      key={transferId}
      referenceType="transfer_request"
      referenceId={Number(transferId)}
      backTo="/purchasing/stock-receiving"
      backLabel="Stock Receiving"
      documentLabel="Transfer"
      documentLink={{ to: "/purchasing/transfers/$transferId", params: { transferId } }}
    />
  );
}
