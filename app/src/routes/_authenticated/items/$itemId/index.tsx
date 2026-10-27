import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useItemBatchesQuery,
  useItemQuery,
  useItemStockQuery,
  useItemTransactionsQuery,
} from "@/hooks/useInventory";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import type { BatchStatus } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items/$itemId/")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemDetailPage,
  errorComponent: RouteErrorFallback,
});

const BATCH_STATUS_VARIANT: Record<BatchStatus, "default" | "outline" | "destructive"> = {
  active: "default",
  expired: "destructive",
  depleted: "outline",
};

function ItemDetailPage() {
  const { itemId } = Route.useParams();
  const id = Number(itemId);
  const itemQuery = useItemQuery(id);

  if (itemQuery.isPending) {
    return <TableSkeleton rows={4} columns={4} />;
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <EmptyState
        title="Couldn't load this item"
        description={itemQuery.error ? getErrorMessage(itemQuery.error) : undefined}
      />
    );
  }

  const item = itemQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {item.category?.name ?? "Uncategorized"} · {item.unit?.name ?? "No unit"} · {item.sku}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={item.is_active ? "default" : "outline"}>
            {item.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button size="sm" variant="outline" render={<Link to="/items/$itemId/edit" params={{ itemId }} />}>
            <Pencil />
            Edit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <BatchesTab itemId={id} />
        </TabsContent>
        <TabsContent value="stock">
          <StockTab itemId={id} />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab itemId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BatchesTab({ itemId }: { itemId: number }) {
  const [page, setPage] = useState(1);
  const batchesQuery = useItemBatchesQuery(itemId, page);

  if (batchesQuery.isPending) {
    return <TableSkeleton rows={5} columns={4} />;
  }

  if (batchesQuery.isError) {
    return <EmptyState title="Couldn't load batches" description={getErrorMessage(batchesQuery.error)} />;
  }

  if (batchesQuery.data.data.length === 0) {
    return <EmptyState title="No batches yet" description="Batches appear here once stock is received." />;
  }

  return (
    <div className="pt-3">
      <RefreshingRegion isRefreshing={batchesQuery.isFetching && batchesQuery.isPlaceholderData}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch Number</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchesQuery.data.data.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>{batch.batch_number}</TableCell>
                <TableCell>{batch.branch?.name ?? "—"}</TableCell>
                <TableCell>{batch.quantity}</TableCell>
                <TableCell>{batch.expiry_date ?? "No expiry"}</TableCell>
                <TableCell>
                  <Badge variant={BATCH_STATUS_VARIANT[batch.status]}>{batch.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination meta={batchesQuery.data.meta} onPageChange={setPage} />
      </RefreshingRegion>
    </div>
  );
}

function StockTab({ itemId }: { itemId: number }) {
  const stockQuery = useItemStockQuery(itemId);
  useInventoryChannels(stockQuery.data?.map((row) => row.branch_id) ?? []);

  if (stockQuery.isPending) {
    return <TableSkeleton rows={2} columns={5} />;
  }

  if (stockQuery.isError) {
    return <EmptyState title="Couldn't load stock" description={getErrorMessage(stockQuery.error)} />;
  }

  if (stockQuery.data.length === 0) {
    return <EmptyState title="No stock data" />;
  }

  return (
    <div className="pt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Reserved</TableHead>
            <TableHead>Incoming</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockQuery.data.map((row) => (
            <TableRow key={row.branch_id}>
              <TableCell>{row.branch_name}</TableCell>
              <TableCell className="font-medium text-foreground">{row.available}</TableCell>
              <TableCell>{row.current}</TableCell>
              <TableCell>{row.reserved}</TableCell>
              <TableCell>{row.incoming}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TransactionsTab({ itemId }: { itemId: number }) {
  const [page, setPage] = useState(1);
  const transactionsQuery = useItemTransactionsQuery(itemId, page);

  if (transactionsQuery.isPending) {
    return <TableSkeleton rows={5} columns={5} />;
  }

  if (transactionsQuery.isError) {
    return (
      <EmptyState title="Couldn't load transactions" description={getErrorMessage(transactionsQuery.error)} />
    );
  }

  if (transactionsQuery.data.data.length === 0) {
    return <EmptyState title="No transactions yet" />;
  }

  return (
    <div className="pt-3">
      <RefreshingRegion isRefreshing={transactionsQuery.isFetching && transactionsQuery.isPlaceholderData}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Performed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsQuery.data.data.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{new Date(transaction.created_at).toLocaleString()}</TableCell>
                <TableCell className="capitalize">{transaction.type.replace("_", " ")}</TableCell>
                <TableCell className={transaction.quantity < 0 ? "text-destructive" : "text-foreground"}>
                  {transaction.quantity > 0 ? `+${transaction.quantity}` : transaction.quantity}
                </TableCell>
                <TableCell>{transaction.branch?.name ?? "—"}</TableCell>
                <TableCell>{transaction.performed_by ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination meta={transactionsQuery.data.meta} onPageChange={setPage} />
      </RefreshingRegion>
    </div>
  );
}
