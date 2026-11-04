import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, CloudAlert, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLogoutMutation, useMeQuery } from "@/hooks/useAuth";
import { usePendingMutationCount } from "@/hooks/usePendingMutations";
import { useActingAsStore } from "@/stores/actingAs.store";
import { ROLE_LABELS, type Role } from "@/types/user";

const SWITCHABLE_ROLES: Role[] = ["admin", "sales", "purchasing"];

export function Topbar() {
  const navigate = useNavigate();
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();
  const pendingMutationCount = usePendingMutationCount();
  const actingAs = useActingAsStore((state) => state.actingAs);
  const setActingAs = useActingAsStore((state) => state.setActingAs);
  const clearActingAs = useActingAsStore((state) => state.clear);

  const user = meQuery.data;

  if (!user) {
    return null;
  }

  function handleSwitchRole(role: Role) {
    setActingAs(role);
    navigate({ to: "/" });
  }

  function handleReturn() {
    clearActingAs();
    navigate({ to: "/" });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate({ to: "/login" }),
    });
  }

  const effectiveRole = actingAs ?? user.role;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2 md:gap-3 md:px-5">
        <SidebarTrigger className="md:hidden" />

        <span className="min-w-0 flex-1 truncate text-xs font-bold tracking-[0.03em] text-muted-foreground">
          {effectiveRole ? `${ROLE_LABELS[effectiveRole]} Workspace` : "Workspace"}
        </span>

        {pendingMutationCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="border-warning text-warning hover:bg-warning-muted hover:text-warning"
            render={<Link to="/sync-issues" />}
            aria-label={`${pendingMutationCount} offline changes waiting to sync`}
          >
            <CloudAlert />
            <span className="font-mono font-bold tabular-nums">{pendingMutationCount}</span>
          </Button>
        )}

        {user.branch && !actingAs && (
          <span className="hidden border border-border bg-subtle px-2.5 py-1 text-xs font-semibold text-foreground sm:inline">
            {user.branch.name}
          </span>
        )}

        {!actingAs && user.role === "super_admin" && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              Switch Role
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Enter a role's working view</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SWITCHABLE_ROLES.map((role) => (
                  <DropdownMenuItem key={role} onClick={() => handleSwitchRole(role)}>
                    {ROLE_LABELS[role]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="flex h-11 items-center gap-2 px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:h-9"
              />
            }
          >
            <Avatar className="size-8 md:size-7">
              <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left md:block">
              <span className="block text-ui leading-none font-medium text-foreground">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{user.position ?? ""}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {actingAs && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-primary-mid bg-primary-light px-4 py-2 md:px-5"
        >
          <p className="text-sm text-primary md:text-xs">
            <span className="font-semibold">Viewing as {ROLE_LABELS[actingAs]}.</span> View only: actions are logged as
            Super Admin.
          </p>
          <Button variant="secondary" size="xs" onClick={handleReturn}>
            Return to Super Admin
          </Button>
        </div>
      )}
    </>
  );
}
