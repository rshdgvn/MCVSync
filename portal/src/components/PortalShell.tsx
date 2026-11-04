import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LoadingButton } from "@/components/LoadingButton";
import { useLogoutMutation, useMeQuery } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", to: "/" as const },
  { label: "Items", to: "/items" as const },
  { label: "Orders", to: "/orders" as const },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate({ to: "/login" }),
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <BrandMark className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground md:text-ui">
                {meQuery.data?.name ?? "MCVSync Portal"}
              </p>
              <p className="hidden truncate text-xs text-faint sm:block">{meQuery.data?.email}</p>
            </div>
          </div>
          <LoadingButton
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            isPending={logoutMutation.isPending}
            pendingText="Signing out…"
          >
            <LogOut />
            Log Out
          </LoadingButton>
        </div>
        <nav aria-label="Portal" className="mx-auto flex max-w-6xl overflow-x-auto px-4 md:px-6">
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 shrink-0 items-center border-b-2 px-4 text-sm transition-colors duration-150 ease-standard md:h-9 md:text-ui",
                  isActive
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 has-[[data-sticky-action-bar]]:pb-[calc(6rem+env(safe-area-inset-bottom))] md:has-[[data-sticky-action-bar]]:pb-6">{children}</main>
    </div>
  );
}
