import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePriceHistoryQuery } from "@/hooks/usePricing";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Client } from "@/types/accounting";
import type { Item } from "@/types/inventory";

interface PriceHistoryDialogProps {
  client: Client;
  item: Item;
  onClose: () => void;
}

export function PriceHistoryDialog({ client, item, onClose }: PriceHistoryDialogProps) {
  const [page, setPage] = useState(1);
  const query = usePriceHistoryQuery(client.id, item.id, page);
  const rows = query.data?.data;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Price History"
      description={
        <>
          <span className="font-semibold text-foreground">{client.name}</span> · {item.name}
        </>
      }
    >
      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="No prices yet" description="This client and item haven't been priced." />
      ) : (
        <div className="flex flex-col gap-3">
          <ol className="divide-y divide-border-subtle border border-border">
            {rows.map((price, index) => (
              <li key={price.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex flex-col">
                  <span className="text-sm md:text-ui">{formatDateTime(price.created_at)}</span>
                  <span className="text-xs text-muted-foreground">Set by {price.set_by}</span>
                </span>
                <span className="flex items-center gap-2">
                  {page === 1 && index === 0 && <StatusBadge status="active" label="Current" />}
                  <span className="font-mono text-sm font-semibold">{formatMoney(price.srp)}</span>
                </span>
              </li>
            ))}
          </ol>
          {query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
        </div>
      )}
    </ResponsiveDialog>
  );
}
