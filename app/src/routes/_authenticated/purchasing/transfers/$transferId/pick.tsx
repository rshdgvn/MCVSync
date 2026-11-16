import { createFileRoute } from "@tanstack/react-router";
import { TransferPickSession } from "@/components/transfers/TransferPickSession";
import { INVENTORY_ACCESS_ROLES, requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/transfers/$transferId/pick")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: PickTransferRoute,
});

function PickTransferRoute() {
  const { transferId } = Route.useParams();
  return <TransferPickSession key={transferId} transferId={Number(transferId)} />;
}
