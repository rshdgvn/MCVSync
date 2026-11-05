import type { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Topbar } from "@/components/Topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useActingAsStore } from "@/stores/actingAs.store";
import type { Role } from "@/types/user";

interface AppShellProps {
  role: Role;
  children: ReactNode;
}

export function AppShell({ role, children }: AppShellProps) {
  const actingAs = useActingAsStore((state) => state.actingAs);
  const effectiveRole = actingAs ?? role;

  return (
    <SidebarProvider>
      <AppSidebar role={effectiveRole} />
      <SidebarInset>
        <Topbar />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 has-[[data-sticky-action-bar]]:pb-[calc(6rem+env(safe-area-inset-bottom))] md:has-[[data-sticky-action-bar]]:pb-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
