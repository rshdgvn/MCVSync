import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/components/suppliers/SuppliersPage";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/admin/suppliers/")({
  beforeLoad: requireRole("admin"),
  component: SuppliersRoute,
});

function SuppliersRoute() {
  return <SuppliersPage section="admin" />;
}
