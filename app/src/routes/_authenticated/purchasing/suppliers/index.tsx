import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/components/suppliers/SuppliersPage";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/purchasing/suppliers/")({
  beforeLoad: requireRole("purchasing"),
  component: SuppliersRoute,
});

function SuppliersRoute() {
  return <SuppliersPage section="purchasing" />;
}
