import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { PortalShell } from "@/components/PortalShell";
import { PortalShellSkeleton } from "@/components/PortalShellSkeleton";
import { meQueryOptions } from "@/hooks/useAuth";
import { activateUserCache } from "@/pwa/userCache";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(meQueryOptions);
      void activateUserCache(user.id);
      return { user };
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
