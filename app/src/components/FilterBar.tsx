import { useEffect, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  activeFilterCount = 0,
  onClearFilters,
}: FilterBarProps) {
  const [draft, setDraft] = useState(search ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedDraft = useDebouncedValue(draft);

  useEffect(() => {
    setDraft(search ?? "");
  }, [search]);

  useEffect(() => {
    if (onSearchChange && debouncedDraft !== (search ?? "")) {
      onSearchChange(debouncedDraft);
    }
  }, [debouncedDraft, search, onSearchChange]);

  return (
    <div className="flex items-center gap-2 md:flex-wrap md:gap-2.5">
      {onSearchChange && (
        <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint md:left-2.5 md:size-3.5" />
          <Input
            type="search"
            enterKeyHint="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="pl-9 md:pl-8"
          />
        </div>
      )}

      {children && (
        <>
          <div className="hidden md:contents">{children}</div>
          <Button
            variant="outline"
            size="icon"
            className="relative md:hidden"
            aria-label="Filters"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <ResponsiveDialog
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            title="Filters"
            footer={
              <>
                {onClearFilters && (
                  <Button variant="outline" onClick={onClearFilters} disabled={activeFilterCount === 0}>
                    Clear Filters
                  </Button>
                )}
                <Button onClick={() => setFiltersOpen(false)}>Done</Button>
              </>
            }
          >
            <div className="flex flex-col gap-3 [&_[data-slot=select-trigger]]:w-full">{children}</div>
          </ResponsiveDialog>
        </>
      )}
    </div>
  );
}
