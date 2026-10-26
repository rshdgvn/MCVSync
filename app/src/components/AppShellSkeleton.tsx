import { CardSkeleton } from "@/components/CardSkeleton";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const SIDEBAR_ITEM_COUNT = 7;

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full bg-background" aria-busy="true" aria-label="Loading">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-2 md:flex">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="size-8 bg-sidebar-accent" />
          <Skeleton className="h-4 w-24 bg-sidebar-accent" />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: SIDEBAR_ITEM_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full bg-sidebar-accent" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="size-7" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-6 w-56" />
          <div className="grid gap-4 sm:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={6} columns={4} />
        </main>
      </div>
    </div>
  );
}
