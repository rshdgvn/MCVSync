import { createFileRoute } from "@tanstack/react-router";
import { SupplierDetailPage } from "@/components/suppliers/SupplierDetailPage";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/suppliers/$supplierId")({
  beforeLoad: requireRole("purchasing"),
  component: SupplierDetailRoute,
});

function SupplierDetailRoute() {
  const { supplierId } = Route.useParams();
  return <SupplierDetailPage key={supplierId} section="purchasing" supplierId={Number(supplierId)} />;
}
