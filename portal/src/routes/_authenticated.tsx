import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { PortalShell } from "@/components/PortalShell";
import { PortalShellSkeleton } from "@/components/PortalShellSkeleton";
import { meQueryOptions } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  pendingComponent: PortalShellSkeleton,
  pendingMs: 150,
  component: () => (
    <PortalShell>
      <Outlet />
    </PortalShell>
  ),
});
