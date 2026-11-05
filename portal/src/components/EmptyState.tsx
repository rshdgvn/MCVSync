import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 flex size-10 items-center justify-center bg-muted text-faint">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground md:text-ui">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground md:text-ui">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
