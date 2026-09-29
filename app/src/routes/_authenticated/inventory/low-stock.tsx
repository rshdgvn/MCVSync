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
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useLowStockAlertsQuery } from "@/hooks/useInventory";
import { useInventoryChannels, usePurchasingOwnBranchIds } from "@/hooks/useInventoryChannels";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/inventory/low-stock")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: LowStockItemsPage,
  errorComponent: RouteErrorFallback,
});

function LowStockItemsPage() {
  const [page, setPage] = useState(1);
  const alertsQuery = useLowStockAlertsQuery({ page });
  useInventoryChannels(usePurchasingOwnBranchIds());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Low Stock</h1>
        <p className="text-sm text-muted-foreground">
          Items whose available stock has dropped to or below their reorder point.
        </p>
      </div>

      {alertsQuery.isPending && <TableSkeleton rows={8} columns={4} />}

      {alertsQuery.isError && (
        <EmptyState
          title="Couldn't load low stock items"
          description={getErrorMessage(alertsQuery.error)}
          action={
            <Button variant="outline" size="sm" onClick={() => alertsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {alertsQuery.data && alertsQuery.data.data.length === 0 && (
        <EmptyState title="Nothing low on stock" description="Every item is above its reorder point." />
      )}

      {alertsQuery.data && alertsQuery.data.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reorder Point</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsQuery.data.data.map((row) => (
                <TableRow key={`${row.item_id}-${row.branch_id}`}>
                  <TableCell className="font-medium text-foreground">
                    <Link to="/items/$itemId" params={{ itemId: String(row.item_id) }} className="hover:underline">
                      {row.item_name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.branch_name}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{row.available}</Badge>
                  </TableCell>
                  <TableCell>{row.reorder_point}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={alertsQuery.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
