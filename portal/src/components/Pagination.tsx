import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types/inventory";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

const GAP = "gap";

function windowedPages(current: number, total: number): (number | typeof GAP)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | typeof GAP)[] = [1];
  const low = Math.max(2, current - 1);
  const high = Math.min(total - 1, current + 1);

  if (low > 2) {
    pages.push(GAP);
  }
  for (let page = low; page <= high; page++) {
    pages.push(page);
  }
  if (high < total - 1) {
    pages.push(GAP);
  }
  pages.push(total);

  return pages;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.last_page <= 1) {
    return null;
  }

  const current = meta.current_page;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5"
    >
      <p className="text-xs text-muted-foreground">
        Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-1 text-xs text-muted-foreground md:hidden">
          {current} / {meta.last_page}
        </span>
        <div className="hidden items-center gap-1.5 md:flex">
          {windowedPages(current, meta.last_page).map((page, index) =>
            page === GAP ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-faint">
                …
              </span>
            ) : (
              <Button
                key={page}
                variant={page === current ? "default" : "outline"}
                size="icon-sm"
                aria-label={`Page ${page}`}
                aria-current={page === current ? "page" : undefined}
                className={cn("min-w-7 px-1.5 font-mono text-xs", page === current && "font-bold")}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            ),
          )}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={current >= meta.last_page}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
