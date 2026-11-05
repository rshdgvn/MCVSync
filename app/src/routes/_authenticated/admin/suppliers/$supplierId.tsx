import { createFileRoute } from "@tanstack/react-router";
import { SupplierDetailPage } from "@/components/suppliers/SupplierDetailPage";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/admin/suppliers/$supplierId")({
  beforeLoad: requireRole("admin"),
  component: SupplierDetailRoute,
});

function SupplierDetailRoute() {
  const { supplierId } = Route.useParams();
  return <SupplierDetailPage key={supplierId} section="admin" supplierId={Number(supplierId)} />;
}
