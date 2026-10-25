import { useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, Settings } from "lucide-react";
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
import { useActingAsStore } from "@/stores/actingAs.store";
import { ROLE_LABELS, type Role } from "@/types/user";

const SWITCHABLE_ROLES: Role[] = ["admin", "sales", "purchasing"];

export function Topbar() {
  const navigate = useNavigate();
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <SidebarTrigger className="md:hidden" />

      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-semibold text-foreground">
          {effectiveRole ? `${ROLE_LABELS[effectiveRole]} Workspace` : "Workspace"}
        </span>
      </div>

      {actingAs ? (
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 text-sm text-primary">
          <span>Viewing as {ROLE_LABELS[actingAs]}</span>
          <Button variant="ghost" size="xs" onClick={handleReturn}>
            Return to Super Admin
          </Button>
        </div>
      ) : (
        user.branch && (
          <span className="text-sm text-muted-foreground">{user.branch.name}</span>
        )
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

      <Button variant="ghost" size="icon-sm">
        <Bell />
        <span className="sr-only">Notifications</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button type="button" className="flex items-center gap-2" />}
        >
          <Avatar className="size-7">
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block text-sm leading-none font-medium">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{user.position ?? ""}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon-sm">
        <Settings />
        <span className="sr-only">Settings</span>
      </Button>
    </header>
  );
}
