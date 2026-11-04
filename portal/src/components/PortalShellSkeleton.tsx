import { DataListSkeleton } from "@/components/DataList";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEM_COUNT = 3;

export function PortalShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background" aria-busy="true" aria-label="Loading">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2 md:px-6">
          {Array.from({ length: NAV_ITEM_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-16" />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-6 w-48" />
        <DataListSkeleton columns={4} rows={6} />
      </main>
    </div>
  );
}
