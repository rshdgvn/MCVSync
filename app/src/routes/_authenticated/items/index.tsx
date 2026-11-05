import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { StockLevelBar } from "@/components/StockLevelBar";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/SelectField";
import { itemQueryOptions, useCategoriesQuery, useItemsQuery } from "@/hooks/useInventory";
import { useItemAlertFlags, type ItemAlertStatus } from "@/hooks/useItemAlertFlags";
import { useInventoryChannels, usePurchasingOwnBranchIds } from "@/hooks/useInventoryChannels";
import { requireRole } from "@/lib/rbac";
import type { Item } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items/")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemsListPage,
});

type StatusFilter = "all" | "active" | "inactive";

const ALERT_BADGE_STATUS: Record<Exclude<ItemAlertStatus, "ok">, string> = {
  low_stock: "low_stock",
  expiring_soon: "near_expiry",
};

const ALL_CATEGORIES = "all";

function ItemsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState<StatusFilter>("all");

  const categoriesQuery = useCategoriesQuery();
  const itemsQuery = useItemsQuery({
    page,
    search: search || undefined,
    category_id: categoryId === ALL_CATEGORIES ? undefined : Number(categoryId),
    is_active: status === "all" ? undefined : status === "active",
  });
  const { statusFor } = useItemAlertFlags();
  useInventoryChannels(usePurchasingOwnBranchIds());

  const counts = itemsQuery.data?.counts;

  function openItem(item: Item) {
    void navigate({ to: "/items/$itemId", params: { itemId: String(item.id) } });
  }

  const columns: DataListColumn<Item>[] = [
    {
      key: "name",
      header: "Item Name",
      mobile: "title",
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: "sku",
      header: "SKU",
      mobile: "subtitle",
      cell: (item) => <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>,
    },
    { key: "category", header: "Category", cell: (item) => item.category?.name ?? "—" },
    { key: "unit", header: "Unit", cell: (item) => item.unit?.code ?? "—" },
    {
      key: "stock",
      header: "Available",
      className: "w-44",
      cell: (item) =>
        item.available === undefined ? "—" : <StockLevelBar available={item.available} reorderPoint={item.reorder_point} />,
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (item) => {
        const alert = statusFor(item.id);
        return (
          <span className="inline-flex flex-wrap gap-1">
            <StatusBadge status={item.is_active ? "active" : "inactive"} />
            {alert !== "ok" && <StatusBadge status={ALERT_BADGE_STATUS[alert]} />}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Items"
        description="The item catalog. Categories and units are managed from their own pages."
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link to="/items/categories" />}>
              Categories
            </Button>
            <Button variant="outline" size="sm" render={<Link to="/items/units" />}>
              Units
            </Button>
          </>
        }
        primaryAction={
          <Button render={<Link to="/items/new" />}>
            <Plus />
            Add Item
          </Button>
        }
      />

      <FilterTabs
        ariaLabel="Filter items by status"
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        tabs={[
          { value: "all", label: "All Items", count: counts?.all },
          { value: "active", label: "Active", count: counts?.active },
          { value: "inactive", label: "Inactive", count: counts?.inactive },
        ]}
      />

      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder="Search by name or SKU"
        activeFilterCount={categoryId === ALL_CATEGORIES ? 0 : 1}
        onClearFilters={() => {
          setCategoryId(ALL_CATEGORIES);
          setPage(1);
        }}
      >
        <SelectField
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value || ALL_CATEGORIES);
            setPage(1);
          }}
          placeholder="Category"
          triggerProps={{ className: "w-full md:w-48", "aria-label": "Category" }}
          options={[
            { value: ALL_CATEGORIES, label: "All Categories" },
            ...(categoriesQuery.data ?? []).map((category) => ({ value: String(category.id), label: category.name })),
          ]}
        />
      </FilterBar>

      <DataList
        label="Items"
        columns={columns}
        rows={itemsQuery.data?.data}
        rowKey={(item) => item.id}
        isPending={itemsQuery.isPending}
        error={itemsQuery.error}
        onRetry={() => void itemsQuery.refetch()}
        isRefreshing={itemsQuery.isFetching && itemsQuery.isPlaceholderData}
        skeletonRows={8}
        empty={{
          title: "No items found",
          description: "Try a different search or filter, or add the first item.",
        }}
        onRowClick={openItem}
        onRowIntent={(item) => void queryClient.prefetchQuery(itemQueryOptions(item.id))}
        rowActions={(item) => [
          { label: "View", icon: Eye, onClick: () => openItem(item) },
          {
            label: "Edit",
            icon: Pencil,
            onClick: () => void navigate({ to: "/items/$itemId/edit", params: { itemId: String(item.id) } }),
          },
        ]}
        footer={itemsQuery.data && <Pagination meta={itemsQuery.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
