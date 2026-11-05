import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RotateCcw, ShoppingCart, Trash2 } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SectionTitle } from "@/components/SectionTitle";
import { StickyActionBar } from "@/components/StickyActionBar";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/SelectField";
import { useCategoriesQuery, useItemsQuery } from "@/hooks/useInventory";
import { formatQuantity } from "@/lib/format";
import type { Item } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items")({
  component: ItemCatalogPage,
});

interface DraftLine {
  item: Item;
  quantity: number;
}

type Draft = Map<number, DraftLine>;

const ALL_CATEGORIES = "all";

function withQuantity(draft: Draft, item: Item, quantity: number): Draft {
  const next = new Map(draft);
  if (quantity <= 0) {
    next.delete(item.id);
  } else {
    next.set(item.id, { item, quantity });
  }
  return next;
}

function ItemCatalogPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [buildMode, setBuildMode] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => new Map());
  const [orderOpen, setOrderOpen] = useState(false);

  const categoriesQuery = useCategoriesQuery();
  const itemsQuery = useItemsQuery({
    page,
    search: search || undefined,
    category_id: categoryId === ALL_CATEGORIES ? undefined : Number(categoryId),
  });

  const lines = [...draft.values()];
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  function setQuantity(item: Item, quantity: number) {
    setDraft((current) => withQuantity(current, item, quantity));
  }

  function exitBuildMode() {
    setBuildMode(false);
    setDraft(new Map());
    setOrderOpen(false);
  }

  const columns: DataListColumn<Item>[] = [
    {
      key: "name",
      header: "Item Name",
      mobile: "title",
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: "description",
      header: "Description",
      mobile: "hidden",
      cell: (item) => <span className="line-clamp-2 text-muted-foreground">{item.description ?? "—"}</span>,
    },
    { key: "category", header: "Category", mobile: "meta", cell: (item) => item.category?.name ?? "—" },
    { key: "unit", header: "Unit", mobile: "meta", cell: (item) => item.unit?.name ?? "—" },
  ];

  if (buildMode) {
    columns.push({
      key: "order",
      header: "Order Qty",
      align: "right",
      mobile: "subtitle",
      className: "w-40",
      cell: (item) => (
        <OrderControl item={item} quantity={draft.get(item.id)?.quantity ?? 0} onChange={setQuantity} />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <PageHeader
          title="Items"
          description="Browse the catalog available to your account."
          actions={
            buildMode && (
              <Button variant="outline" size="sm" onClick={exitBuildMode}>
                <RotateCcw />
                Cancel Purchase Order
              </Button>
            )
          }
          primaryAction={
            !buildMode && (
              <Button onClick={() => setBuildMode(true)}>
                <ShoppingCart />
                Start Purchase Order
              </Button>
            )
          }
        />

        <FilterBar
          search={search}
          onSearchChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          searchPlaceholder="Search items"
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
          empty={{ title: "No items found", description: "Try a different search or category." }}
          footer={itemsQuery.data && <Pagination meta={itemsQuery.data.meta} onPageChange={setPage} />}
        />
      </div>

      {buildMode && (
        <>
          <aside className="hidden w-80 shrink-0 border border-border bg-card lg:sticky lg:top-28 lg:block">
            <div className="border-b border-border-subtle px-4 py-3">
              <SectionTitle>Purchase Order</SectionTitle>
            </div>
            <OrderSummary lines={lines} totalQuantity={totalQuantity} onQuantityChange={setQuantity} />
          </aside>

          <div className="lg:hidden">
            <StickyActionBar>
              <Button className="w-full" onClick={() => setOrderOpen(true)}>
                <ShoppingCart />
                View Order ({formatQuantity(totalQuantity)})
              </Button>
            </StickyActionBar>
          </div>

          <ResponsiveDialog open={orderOpen} onOpenChange={setOrderOpen} title="Purchase Order">
            <OrderSummary lines={lines} totalQuantity={totalQuantity} onQuantityChange={setQuantity} />
          </ResponsiveDialog>
        </>
      )}
    </div>
  );
}

function OrderControl({
  item,
  quantity,
  onChange,
}: {
  item: Item;
  quantity: number;
  onChange: (item: Item, quantity: number) => void;
}) {
  if (quantity === 0) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange(item, 1)}>
        <Plus />
        Add
      </Button>
    );
  }

  return (
    <QuantityInput
      label={`quantity for ${item.name}`}
      value={quantity}
      onChange={(next) => onChange(item, next)}
      className="justify-start md:justify-end"
    />
  );
}

function OrderSummary({
  lines,
  totalQuantity,
  onQuantityChange,
}: {
  lines: DraftLine[];
  totalQuantity: number;
  onQuantityChange: (item: Item, quantity: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:p-4">
      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No items added yet"
          description="Use Add on any item to start building your order."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {lines.map(({ item, quantity }) => (
            <li key={item.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground md:text-ui">{item.name}</span>
              <QuantityInput
                label={`quantity for ${item.name}`}
                value={quantity}
                min={1}
                onChange={(next) => onQuantityChange(item, next)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.name}`}
                onClick={() => onQuantityChange(item, 0)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm md:text-ui">
        <span className="text-muted-foreground">Total quantity</span>
        <span className="font-mono font-semibold tabular-nums">{formatQuantity(totalQuantity)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button disabled className="w-full">
          Submit Purchase Order
        </Button>
        <p className="text-center text-xs text-faint">Order submission opens in a later update.</p>
      </div>
    </div>
  );
}
