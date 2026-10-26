import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AppShellSkeleton } from "@/components/AppShellSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { EchoProvider } from "@/providers/EchoProvider";
import { meQueryOptions, useMeQuery } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(meQueryOptions);
      return { user };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
  pendingComponent: AppShellSkeleton,
  pendingMs: 150,
  errorComponent: RouteErrorFallback,
});

function AuthenticatedLayout() {
  const meQuery = useMeQuery();
  const user = meQuery.data;

  if (!user) {
    return null;
  }

  if (!user.role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          title="No role assigned"
          description="Your account doesn't have a role assigned yet. Contact your administrator."
        />
      </div>
    );
  }

  return (
    <EchoProvider user={user}>
      <AppShell role={user.role}>
        <Outlet />
      </AppShell>
    </EchoProvider>
  );
}
