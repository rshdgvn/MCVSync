import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  variant?: "inline" | "menu";
}

export function RowActions({ actions, variant = "inline" }: RowActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  if (variant === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Row actions"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
              }}
            >
              <action.icon />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          size="icon-sm"
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            action.destructive && "hover:bg-danger-muted hover:text-danger",
          )}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
        >
          <action.icon />
        </Button>
      ))}
    </div>
  );
}
