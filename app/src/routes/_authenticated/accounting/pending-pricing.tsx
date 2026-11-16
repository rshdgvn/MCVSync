import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { ACCOUNTING_ROLES, requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/accounting/pending-pricing")({
  beforeLoad: requireRole(...ACCOUNTING_ROLES),
  component: PendingPricingPage,
});

function PendingPricingPage() {
  return (
    <PlaceholderPage
      title="Pending Pricing Requests"
      description="This queue fills from Client Order Forms with items that have no price yet. It starts working once the Sales module is built. Until then, set prices from Client Item Pricing."
    />
  );
}
