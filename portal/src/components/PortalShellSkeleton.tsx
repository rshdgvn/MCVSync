import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEM_COUNT = 3;
const CARD_COUNT = 6;

export function PortalShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background" aria-busy="true" aria-label="Loading">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-20" />
      </header>

      <nav className="flex items-center gap-2 border-b border-border px-4 py-2">
        {Array.from({ length: NAV_ITEM_COUNT }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-16" />
        ))}
      </nav>

      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <div key={index} className="space-y-3 border border-border p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
