import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { useMeQuery } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/types/user";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const meQuery = useMeQuery();
  const user = meQuery.data;

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Welcome, ${user.name}`} description={user.email} />

      <StatCardGrid>
        <StatCard label="Role" numeric={false} value={user.role ? ROLE_LABELS[user.role] : "None"} />
        <StatCard label="Branch" numeric={false} value={user.branch?.name ?? "All branches"} />
        <StatCard label="Permissions" value={user.permissions.length} sub="granted to your role" />
      </StatCardGrid>
    </div>
  );
}
