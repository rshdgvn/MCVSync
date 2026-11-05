import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, type LucideIcon } from "lucide-react";
import { MicroLabel } from "@/components/MicroLabel";
import { StickyActionBar } from "@/components/StickyActionBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OverflowAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

interface DetailHeaderProps {
  backTo: LinkProps["to"];
  backLabel?: string;
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
  overflowActions?: OverflowAction[];
  primaryAction?: ReactNode;
}

export function DetailHeader({
  backTo,
  backLabel = "Back",
  eyebrow,
  title,
  meta,
  overflowActions = [],
  primaryAction,
}: DetailHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 md:-ml-2.5" render={<Link to={backTo} />}>
          <ArrowLeft />
          {backLabel}
        </Button>
        <div className="flex items-center gap-2">
          {primaryAction && <div className="hidden md:contents">{primaryAction}</div>}
          {overflowActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {overflowActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    variant={action.destructive ? "destructive" : "default"}
                    onClick={action.onSelect}
                  >
                    {action.icon && <action.icon />}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="mt-3 min-w-0">
        {eyebrow && <MicroLabel className="mb-0.5 text-muted-foreground">{eyebrow}</MicroLabel>}
        <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">{meta}</div>}
      </div>
      {primaryAction && <StickyActionBar>{primaryAction}</StickyActionBar>}
    </>
  );
}
