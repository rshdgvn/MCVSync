import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabBarTab<TValue extends string> {
  value: TValue;
  label: string;
}

interface TabBarProps<TValue extends string> {
  tabs: TabBarTab<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  actions?: ReactNode;
  ariaLabel: string;
}

export function TabBar<TValue extends string>({ tabs, value, onChange, actions, ariaLabel }: TabBarProps<TValue>) {
  return (
    <div className="flex flex-col gap-2 border-b border-border md:flex-row md:items-end md:justify-between">
      <div role="tablist" aria-label={ariaLabel} className="-mx-4 flex overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => {
          const isActive = tab.value === value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.value)}
              className={cn(
                "-mb-px h-11 shrink-0 border-b-2 px-4 text-sm transition-colors duration-150 ease-standard outline-none focus-visible:bg-subtle md:h-9 md:text-ui",
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 pb-2 md:justify-end md:pb-1.5">{actions}</div>}
    </div>
  );
}
