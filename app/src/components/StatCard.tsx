import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { MicroLabel } from "@/components/MicroLabel";
import { TrendSparkline } from "@/components/TrendSparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: number[];
  numeric?: boolean;
  link?: Pick<LinkProps, "to" | "search">;
}

const CARD_CLASS = "flex min-h-[86px] flex-col justify-between gap-1 border border-border bg-card px-4 py-3";

export function StatCard({ label, value, sub, trend, numeric = true, link }: StatCardProps) {
  const body = (
    <>
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            "font-bold text-foreground",
            numeric ? "font-mono text-xl tabular-nums md:text-[22px]" : "truncate text-base md:text-lg",
          )}
        >
          {value}
        </span>
        {trend && <TrendSparkline values={trend} label={`${label} trend`} />}
      </div>
      {sub && <span className="text-xs text-faint">{sub}</span>}
    </>
  );

  if (link) {
    return (
      <Link
        {...link}
        className={cn(CARD_CLASS, "transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none")}
      >
        {body}
      </Link>
    );
  }

  return <div className={CARD_CLASS}>{body}</div>;
}

export function StatCardSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-[86px] flex-col justify-between gap-2 border border-border bg-card px-4 py-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

interface StatCardGridProps {
  children: ReactNode;
  className?: string;
}

export function StatCardGrid({ children, className }: StatCardGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]", className)}>
      {children}
    </div>
  );
}
