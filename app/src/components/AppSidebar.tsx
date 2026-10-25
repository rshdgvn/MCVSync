import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { NAVIGATION, findActiveKeys, type NavItem } from "@/config/navigation";
import { useMotionTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/user";

const COLLAPSIBLE_FADE =
  "transition-[opacity,visibility] duration-300 ease-out group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0";

interface AppSidebarProps {
  role: Role;
  badges?: Record<string, number>;
}

export function AppSidebar({ role, badges = {} }: AppSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = NAVIGATION[role];
  const { parentKey } = findActiveKeys(items, pathname);
  const [expandedKey, setExpandedKey] = useState<string | null>(parentKey ?? null);
  const transition = useMotionTransition();

  useEffect(() => {
    if (parentKey) {
      setExpandedKey(parentKey);
    }
  }, [parentKey]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 overflow-hidden py-1">
          <div className="flex size-8 shrink-0 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
            M
          </div>
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground", COLLAPSIBLE_FADE)}>
            MCVSync
          </span>
          <SidebarTrigger
            className={cn(
              "hidden shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex",
              COLLAPSIBLE_FADE,
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <NavEntry
                  key={item.key}
                  item={item}
                  pathname={pathname}
                  badges={badges}
                  expanded={expandedKey === item.key}
                  onToggle={() =>
                    setExpandedKey((current) => (current === item.key ? null : item.key))
                  }
                  transition={transition}
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
  pathname: string;
  badges: Record<string, number>;
  expanded: boolean;
  onToggle: () => void;
  transition: ReturnType<typeof useMotionTransition>;
}

function NavEntry({ item, pathname, badges, expanded, onToggle, transition }: NavEntryProps) {
  const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;

  if (!item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={item.to === pathname}
          tooltip={item.label}
          render={<Link to={item.to ?? "/"} />}
        >
          <item.icon className="size-4 shrink-0" />
          <span className={cn("min-w-0 truncate", COLLAPSIBLE_FADE)}>{item.label}</span>
        </SidebarMenuButton>
        {!!badgeCount && <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={onToggle} tooltip={item.label}>
        <item.icon className="size-4 shrink-0" />
        <span className={cn("min-w-0 truncate", COLLAPSIBLE_FADE)}>{item.label}</span>
        <ChevronRight
          className={cn(
            "ml-auto size-4 shrink-0 transition-[transform,opacity,visibility] duration-300 ease-out group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0",
            expanded && "rotate-90",
          )}
        />
      </SidebarMenuButton>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            style={{ overflow: "hidden" }}
          >
            <SidebarMenuSub>
              {item.children.map((child) => {
                const childBadge = child.badgeKey ? badges[child.badgeKey] : undefined;

                return (
                  <SidebarMenuSubItem key={child.key}>
                    <SidebarMenuSubButton
                      isActive={child.to === pathname}
                      render={<Link to={child.to ?? "/"} />}
                    >
                      <span className="min-w-0 truncate">{child.label}</span>
                    </SidebarMenuSubButton>
                    {!!childBadge && <SidebarMenuBadge>{childBadge}</SidebarMenuBadge>}
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarMenuItem>
  );
}
