import { cn } from "@/lib/utils";

export interface FilterTab<TValue extends string> {
  value: TValue;
  label: string;
  count?: number;
}

interface FilterTabsProps<TValue extends string> {
  tabs: FilterTab<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
}

export function FilterTabs<TValue extends string>({ tabs, value, onChange, ariaLabel }: FilterTabsProps<TValue>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
    >
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
              "flex h-11 shrink-0 items-center gap-2 border px-3.5 text-sm font-medium transition-colors duration-150 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:h-8 md:text-xs",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground-soft hover:bg-subtle",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-px font-mono text-[11px] font-bold tabular-nums",
                  isActive ? "bg-primary-foreground/25 text-primary-foreground" : "bg-muted text-foreground-soft",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
