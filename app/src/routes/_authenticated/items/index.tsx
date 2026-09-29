import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { StockStatusBadge } from "@/components/StockStatusBadge";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCategoriesQuery, useItemsQuery } from "@/hooks/useInventory";
import { useItemAlertFlags } from "@/hooks/useItemAlertFlags";
import { useInventoryChannels, usePurchasingOwnBranchIds } from "@/hooks/useInventoryChannels";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/items/")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemsListPage,
  errorComponent: RouteErrorFallback,
});

type StatusFilter = "all" | "active" | "inactive";

function ItemsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const debouncedSearch = useDebouncedValue(search);

  const categoriesQuery = useCategoriesQuery();
  const itemsQuery = useItemsQuery({
    page,
    search: debouncedSearch || undefined,
    category_id: categoryId === "all" ? undefined : Number(categoryId),
    is_active: status === "all" ? undefined : status === "active",
  });
  const { statusFor } = useItemAlertFlags();
  useInventoryChannels(usePurchasingOwnBranchIds());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Items</h1>
          <p className="text-sm text-muted-foreground">
            Manage the item catalog — categories, units, and stock alerts live here too.
          </p>
        </div>
        <Button size="sm" render={<Link to="/items/new" />}>
          <Plus />
          New Item
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            setCategoryId(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoriesQuery.data?.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus((value as StatusFilter) ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Link
          to="/items/categories"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Manage categories
        </Link>
        <Link
          to="/items/units"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Manage units
        </Link>
      </div>

      {itemsQuery.isPending && <TableSkeleton rows={8} columns={6} />}

      {itemsQuery.isError && (
        <EmptyState
          title="Couldn't load items"
          description={getErrorMessage(itemsQuery.error)}
          action={
            <Button variant="outline" size="sm" onClick={() => itemsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {itemsQuery.data && itemsQuery.data.data.length === 0 && (
        <EmptyState
          title="No items found"
          description="Try a different search or filter, or create the first item."
        />
      )}

      {itemsQuery.data && itemsQuery.data.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsQuery.data.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      to="/items/$itemId"
                      params={{ itemId: String(item.id) }}
                      className="hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.category?.name ?? "—"}</TableCell>
                  <TableCell>{item.unit?.code ?? "—"}</TableCell>
                  <TableCell>
                    <StockStatusBadge status={statusFor(item.id)} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "default" : "outline"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={itemsQuery.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
