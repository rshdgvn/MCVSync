import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { ReceivingLine } from "@/api/receiving";
import { EmptyState } from "@/components/EmptyState";
import { QuantityProgress } from "@/components/QuantityProgress";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { remainingQuantity } from "@/components/receiving/receivingLineState";

interface ChooseLineDialogProps {
  lines: ReceivingLine[];
  onSelect: (line: ReceivingLine) => void;
  onClose: () => void;
}

export function ChooseLineDialog({ lines, onSelect, onClose }: ChooseLineDialogProps) {
  const [query, setQuery] = useState("");
  const remainingLines = useMemo(() => lines.filter((line) => remainingQuantity(line) > 0), [lines]);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? remainingLines.filter(
        (line) => line.item.name.toLowerCase().includes(needle) || line.item.sku.toLowerCase().includes(needle),
      )
    : remainingLines;

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()} title="Choose Item" description="Items still expected on this document.">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            enterKeyHint="search"
            aria-label="Search items"
            placeholder="Search by name or SKU"
            className="pl-9"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {matches.length === 0 ? (
          <EmptyState
            title={remainingLines.length === 0 ? "Everything has been received" : "No matching items"}
            description={remainingLines.length === 0 ? "Every line on this document is fully received." : "Try a different name or SKU."}
          />
        ) : (
          <ul className="divide-y divide-border-subtle border border-border">
            {matches.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => onSelect(line)}
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle focus-visible:bg-subtle"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium md:text-ui">{line.item.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
                    <QuantityProgress value={line.received} total={line.expected} className="max-w-48" />
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ResponsiveDialog>
  );
}
