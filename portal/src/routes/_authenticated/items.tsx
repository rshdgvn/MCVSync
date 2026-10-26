import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, RotateCcw, Search, ShoppingCart, Trash2 } from "lucide-react";
import { RefreshingRegion } from "@/components/RefreshingRegion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCategoriesQuery, useItemsQuery } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/errors";
import type { Item } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items")({
  component: ItemCatalogPage,
});

interface DraftLine {
  item: Item;
  quantity: number;
}

function ItemCatalogPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [buildMode, setBuildMode] = useState(false);
  const [draft, setDraft] = useState<Record<number, DraftLine>>({});
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const categoriesQuery = useCategoriesQuery();
  const itemsQuery = useItemsQuery({
    page,
    search: debouncedSearch || undefined,
    category_id: categoryId === "all" ? undefined : Number(categoryId),
  });

  const draftLines = Object.values(draft);
  const totalQuantity = draftLines.reduce((sum, line) => sum + line.quantity, 0);

  function addItem(item: Item) {
    setDraft((current) => ({
      ...current,
      [item.id]: { item, quantity: (current[item.id]?.quantity ?? 0) + 1 },
    }));
  }

  function setQuantity(itemId: number, quantity: number) {
    setDraft((current) => {
      if (quantity <= 0) {
        const { [itemId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [itemId]: { ...current[itemId], quantity } };
    });
  }

  function removeItem(itemId: number) {
    setDraft((current) => {
      const { [itemId]: _removed, ...rest } = current;
      return rest;
    });
  }

  function exitBuildMode() {
    setBuildMode(false);
    setDraft({});
    setMobileOrderOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Items</h1>
            <p className="text-sm text-muted-foreground">Browse the catalog available to your account.</p>
          </div>
          {!buildMode ? (
            <Button size="sm" onClick={() => setBuildMode(true)}>
              <ShoppingCart />
              Start Purchase Order
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={exitBuildMode}>
              <RotateCcw />
              Cancel Purchase Order
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items"
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
        </div>

        {itemsQuery.isPending && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        )}

        {itemsQuery.isError && (
          <div className="rounded-none border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">Couldn't load items</p>
            <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(itemsQuery.error)}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => itemsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {itemsQuery.data && itemsQuery.data.data.length === 0 && (
          <div className="rounded-none border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
          </div>
        )}

        {itemsQuery.data && itemsQuery.data.data.length > 0 && (
          <RefreshingRegion isRefreshing={itemsQuery.isFetching && itemsQuery.isPlaceholderData}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {itemsQuery.data.data.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  buildMode={buildMode}
                  quantity={draft[item.id]?.quantity ?? 0}
                  onAdd={() => addItem(item)}
                  onQuantityChange={(quantity) => setQuantity(item.id, quantity)}
                />
              ))}
            </div>
          </RefreshingRegion>
        )}

        {itemsQuery.data && itemsQuery.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Page {itemsQuery.data.meta.current_page} of {itemsQuery.data.meta.last_page}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={itemsQuery.data.meta.current_page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={itemsQuery.data.meta.current_page >= itemsQuery.data.meta.last_page}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {buildMode && (
        <>
          <aside className="hidden w-80 shrink-0 lg:block">
            <div className="sticky top-4 border border-border">
              <OrderPanelContent
                lines={draftLines}
                totalQuantity={totalQuantity}
                onQuantityChange={setQuantity}
                onRemove={removeItem}
              />
            </div>
          </aside>

          <Button
            className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 shadow-lg lg:hidden"
            onClick={() => setMobileOrderOpen(true)}
          >
            <ShoppingCart />
            View Order ({totalQuantity})
          </Button>

          <Sheet open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}>
            <SheetContent side="bottom" className="max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Purchase Order</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <OrderPanelContent
                  lines={draftLines}
                  totalQuantity={totalQuantity}
                  onQuantityChange={setQuantity}
                  onRemove={removeItem}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function ItemCard({
  item,
  buildMode,
  quantity,
  onAdd,
  onQuantityChange,
}: {
  item: Item;
  buildMode: boolean;
  quantity: number;
  onAdd: () => void;
  onQuantityChange: (quantity: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{item.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.category && <Badge variant="outline">{item.category.name}</Badge>}
          {item.unit && <Badge variant="secondary">{item.unit.name}</Badge>}
        </div>
        {item.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}

        {buildMode && (
          <div className="pt-1">
            {quantity === 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={onAdd}>
                <Plus />
                Add
              </Button>
            ) : (
              <div className="flex w-fit items-center gap-2 border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onQuantityChange(quantity - 1)}
                >
                  <Minus />
                  <span className="sr-only">Decrease</span>
                </Button>
                <span className="min-w-6 text-center text-sm font-medium">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onQuantityChange(quantity + 1)}
                >
                  <Plus />
                  <span className="sr-only">Increase</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderPanelContent({
  lines,
  totalQuantity,
  onQuantityChange,
  onRemove,
}: {
  lines: DraftLine[];
  totalQuantity: number;
  onQuantityChange: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="hidden lg:block">
        <h2 className="text-sm font-semibold text-foreground">Purchase Order</h2>
        <p className="text-xs text-muted-foreground">{totalQuantity} item(s) added</p>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items added yet. Use "+ Add" on any item.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lines.map(({ item, quantity }) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.name}</p>
              </div>
              <Label htmlFor={`qty-${item.id}`} className="sr-only">
                Quantity for {item.name}
              </Label>
              <Input
                id={`qty-${item.id}`}
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => onQuantityChange(item.id, Number(event.target.value))}
                className="w-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator />

      <Tooltip>
        <TooltipTrigger render={<span tabIndex={0} className="block w-full" />}>
          <Button disabled className="pointer-events-none w-full">
            Submit Purchase Order
          </Button>
        </TooltipTrigger>
        <TooltipContent>Order submission isn't live yet — coming in a later update.</TooltipContent>
      </Tooltip>
    </div>
  );
}
