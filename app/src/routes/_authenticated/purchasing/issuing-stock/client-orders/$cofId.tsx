import { createFileRoute } from "@tanstack/react-router";
import { CofPickSession } from "@/components/issuing-stock/CofPickSession";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { INVENTORY_ACCESS_ROLES, requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/issuing-stock/client-orders/$cofId")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: PickClientOrderRoute,
  errorComponent: RouteErrorFallback,
});

function PickClientOrderRoute() {
  const { cofId } = Route.useParams();
  return <CofPickSession key={cofId} cofId={Number(cofId)} />;
}
