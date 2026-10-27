import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RefreshingRegionProps {
  isRefreshing: boolean;
  children: ReactNode;
}

export function RefreshingRegion({ isRefreshing, children }: RefreshingRegionProps) {
  return (
    <div className="relative" aria-busy={isRefreshing}>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-2 h-0.5 bg-primary opacity-0 transition-opacity",
          isRefreshing && "animate-pulse opacity-100",
        )}
      />
      <div
        className={cn(
          "flex flex-col gap-4 transition-opacity duration-200",
          isRefreshing && "opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}
