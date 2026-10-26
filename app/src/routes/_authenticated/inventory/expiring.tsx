import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RefreshingRegion } from "@/components/RefreshingRegion";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useExpiringAlertsQuery } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/inventory/expiring")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ExpiringItemsPage,
  errorComponent: RouteErrorFallback,
});

function ExpiringItemsPage() {
  const [page, setPage] = useState(1);
  const alertsQuery = useExpiringAlertsQuery({ page });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Near-Expiry Items</h1>
        <p className="text-sm text-muted-foreground">
          Active batches expiring within their item's alert threshold.
        </p>
      </div>

      {alertsQuery.isPending && <TableSkeleton rows={8} columns={4} />}

      {alertsQuery.isError && (
        <EmptyState
          title="Couldn't load expiring batches"
          description={getErrorMessage(alertsQuery.error)}
          action={
            <Button variant="outline" size="sm" onClick={() => alertsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {alertsQuery.data && alertsQuery.data.data.length === 0 && (
        <EmptyState title="Nothing near expiry" description="Every active batch is outside its alert window." />
      )}

      {alertsQuery.data && alertsQuery.data.data.length > 0 && (
        <RefreshingRegion isRefreshing={alertsQuery.isFetching && alertsQuery.isPlaceholderData}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch Number</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Expiry Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsQuery.data.data.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium text-foreground">
                    {batch.item ? (
                      <Link
                        to="/items/$itemId"
                        params={{ itemId: String(batch.item.id) }}
                        className="hover:underline"
                      >
                        {batch.item.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{batch.batch_number}</TableCell>
                  <TableCell>{batch.branch?.name ?? "—"}</TableCell>
                  <TableCell>{batch.quantity}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      {batch.expiry_date}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={alertsQuery.data.meta} onPageChange={setPage} />
        </RefreshingRegion>
      )}
    </div>
  );
}
