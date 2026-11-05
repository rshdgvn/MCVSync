import { DataListSkeleton } from "@/components/DataList";
import { StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

const SIDEBAR_ITEM_COUNT = 7;

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh w-full bg-background" aria-busy="true" aria-label="Loading">
      <aside className="hidden w-[13.75rem] shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-2 md:flex">
        <div className="flex h-11 items-center gap-2.5 pl-1">
          <Skeleton className="size-7 bg-sidebar-accent" />
          <Skeleton className="h-4 w-24 bg-sidebar-accent" />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: SIDEBAR_ITEM_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full bg-sidebar-accent" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-5">
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="size-8 md:size-7" />
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-6 w-56" />
          <StatCardGrid>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </StatCardGrid>
          <DataListSkeleton columns={4} rows={6} />
        </main>
      </div>
    </div>
  );
}
