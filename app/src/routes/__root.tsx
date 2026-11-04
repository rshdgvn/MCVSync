import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { OfflineBanner } from "@/components/OfflineBanner";

export interface RouterContext {
  queryClient: QueryClient;
}

const RootLayout = () => (
  <>
    <OfflineBanner />
    <Outlet />
  </>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
