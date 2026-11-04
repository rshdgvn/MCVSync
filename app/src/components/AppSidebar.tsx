import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAVIGATION, findActiveKeys, type ActiveNavKeys, type NavItem } from "@/config/navigation";
import { FAST_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/user";

const COLLAPSIBLE_FADE =
  "transition-[opacity,visibility] duration-200 ease-standard group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0";

interface AppSidebarProps {
  role: Role;
  badges?: Record<string, number>;
}

export function AppSidebar({ role, badges = {} }: AppSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();
  const items = NAVIGATION[role];
  const activeKeys = findActiveKeys(items, pathname);
  const { parentKey } = activeKeys;
  const [expandedKey, setExpandedKey] = useState<string | null>(parentKey ?? null);

  useEffect(() => {
    if (parentKey) {
      setExpandedKey(parentKey);
    }
  }, [parentKey]);

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-11 items-center gap-2.5 overflow-hidden pl-1">
          <div className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <BrandMark className="size-4" />
          </div>
          <span className={cn("min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-tight text-sidebar-primary-foreground", COLLAPSIBLE_FADE)}>
            MCVSync
          </span>
          <SidebarTrigger
            className={cn(
              "hidden shrink-0 text-sidebar-icon hover:bg-sidebar-hover hover:text-sidebar-hover-foreground md:inline-flex",
              COLLAPSIBLE_FADE,
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {items.map((item) => (
                <NavEntry
                  key={item.key}
                  item={item}
                  activeKeys={activeKeys}
                  badges={badges}
                  expanded={expandedKey === item.key}
                  onToggle={() =>
                    setExpandedKey((current) => (current === item.key ? null : item.key))
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="overflow-hidden">
        <span className={cn("px-2 text-xs whitespace-nowrap text-sidebar-foreground/60", COLLAPSIBLE_FADE)}>
          v1.0 · MCVSync
        </span>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

interface NavEntryProps {
  item: NavItem;
  activeKeys: ActiveNavKeys;
  badges: Record<string, number>;
  expanded: boolean;
  onToggle: () => void;
}

function NavEntry({ item, activeKeys, badges, expanded, onToggle }: NavEntryProps) {
  const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;

  if (!item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={activeKeys.parentKey === item.key && !activeKeys.childKey}
          tooltip={item.label}
          render={<Link to={item.to ?? "/"} />}
        >
          <item.icon />
          <span className={cn("min-w-0 truncate", COLLAPSIBLE_FADE)}>{item.label}</span>
        </SidebarMenuButton>
        {!!badgeCount && <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={onToggle} tooltip={item.label} aria-expanded={expanded}>
        <item.icon />
        <span className={cn("min-w-0 truncate", COLLAPSIBLE_FADE)}>{item.label}</span>
        <ChevronRight
          className={cn(
            "ml-auto size-3.5 shrink-0 transition-[transform,opacity,visibility] duration-150 ease-standard group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0",
            expanded && "rotate-90",
          )}
        />
      </SidebarMenuButton>

      {expanded && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={FAST_TRANSITION}>
          <SidebarMenuSub>
            {item.children.map((child) => {
              const childBadge = child.badgeKey ? badges[child.badgeKey] : undefined;

              return (
                <SidebarMenuSubItem key={child.key}>
                  <SidebarMenuSubButton isActive={activeKeys.parentKey === item.key && activeKeys.childKey === child.key} render={<Link to={child.to ?? "/"} />}>
                    <span className="min-w-0 truncate">{child.label}</span>
                  </SidebarMenuSubButton>
                  {!!childBadge && <SidebarMenuBadge>{childBadge}</SidebarMenuBadge>}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </motion.div>
      )}
    </SidebarMenuItem>
  );
}
