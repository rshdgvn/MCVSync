import type { ReactNode } from "react";
import { StickyActionBar } from "@/components/StickyActionBar";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  primaryAction?: ReactNode;
}

export function PageHeader({ title, description, actions, primaryAction }: PageHeaderProps) {
  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground md:text-ui">{description}</p>}
        </div>
        {(actions || primaryAction) && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {primaryAction && <div className="hidden md:contents">{primaryAction}</div>}
          </div>
        )}
      </div>
      {primaryAction && <StickyActionBar>{primaryAction}</StickyActionBar>}
    </>
  );
}
