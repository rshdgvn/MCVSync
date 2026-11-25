import { useState, type ReactNode } from "react";
import type { LinkProps } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ListChecks } from "lucide-react";
import { DetailHeader } from "@/components/DetailHeader";
import { FormError } from "@/components/FormError";
import { MicroLabel } from "@/components/MicroLabel";
import { QuantityProgress } from "@/components/QuantityProgress";
import { ScanInput, type ScanEvent, type ScanOutcome } from "@/components/ScanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { TabBar } from "@/components/TabBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { hasProgress, lineState, remainingQuantity, type StockFlowLine } from "@/components/stock-flow/stockFlowLines";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface StockFlowHighlight {
  lineId: number;
  key: number;
}

type MobilePanel = "expected" | "done";

const HIGHLIGHT_DELAY_SECONDS = 0.6;

interface StockFlowShellProps {
  backTo: LinkProps["to"];
  backLabel: string;
  eyebrow: string;
  documentNumber: string;
  meta: ReactNode;
  primaryAction?: ReactNode;
  overflowActions?: Parameters<typeof DetailHeader>[0]["overflowActions"];
  progress: { finished: number; total: number; label: string };
  chips: ReactNode;
  notice?: ReactNode;
  result?: ReactNode;
  lines: StockFlowLine[];
  expectedTitle: string;
  expectedTabLabel: string;
  doneTitle: string;
  doneTabLabel: string;
  doneEmptyText: string;
  scanTitle: string;
  canScan: boolean;
  onScan: (scan: ScanEvent) => ScanOutcome | Promise<ScanOutcome>;
  onChooseItem: () => void;
  onSelectLine?: (line: StockFlowLine) => void;
  scanError: string | null;
  scanAside?: ReactNode;
  highlight: StockFlowHighlight | null;
  children?: ReactNode;
}

export function StockFlowShell({
  backTo,
  backLabel,
  eyebrow,
  documentNumber,
  meta,
  primaryAction,
  overflowActions,
  progress,
  chips,
  notice,
  result,
  lines,
  expectedTitle,
  expectedTabLabel,
  doneTitle,
  doneTabLabel,
  doneEmptyText,
  scanTitle,
  canScan,
  onScan,
  onChooseItem,
  onSelectLine,
  scanError,
  scanAside,
  highlight,
  children,
}: StockFlowShellProps) {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("expected");
  const doneLines = lines.filter(hasProgress);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DetailHeader
          backTo={backTo}
          backLabel={backLabel}
          eyebrow={eyebrow}
          title={<span className="font-mono">{documentNumber}</span>}
          meta={meta}
          primaryAction={primaryAction}
          overflowActions={overflowActions}
        />
      </div>

      <section
        aria-label="Session progress"
        className="flex flex-col gap-2 border border-border bg-card px-4 py-3 md:flex-row md:items-center md:gap-6"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-extrabold text-primary">{progress.finished}</span>
          <span className="font-mono text-base font-bold text-faint">/ {progress.total}</span>
          <span className="ml-1 text-xs text-muted-foreground">{progress.label}</span>
        </div>
        <QuantityProgress value={progress.finished} total={progress.total} className="md:max-w-64 md:flex-1" />
        <div className="flex flex-wrap gap-1.5">{chips}</div>
      </section>

      {notice}

      {result ?? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:items-start">
          <section
            aria-label="Scan panel"
            className="sticky top-0 z-10 -mx-4 border-y border-border bg-card px-4 py-3 md:mx-0 md:border-x lg:static lg:order-2 lg:p-4"
          >
            <MicroLabel className="mb-2">{scanTitle}</MicroLabel>
            {canScan ? (
              <div className="flex flex-col gap-2">
                <ScanInput onScan={onScan} />
                <FormError message={scanError} />
                <Button variant="ghost" size="sm" className="self-start" onClick={onChooseItem}>
                  <ListChecks />
                  No barcode? Choose item
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground md:text-ui">Scanning is off for this document.</p>
            )}
            {scanAside}
          </section>

          <div className="lg:hidden">
            <TabBar
              ariaLabel="Session lines"
              value={mobilePanel}
              onChange={setMobilePanel}
              tabs={[
                { value: "expected", label: `${expectedTabLabel} (${lines.length})` },
                { value: "done", label: `${doneTabLabel} (${doneLines.length})` },
              ]}
            />
          </div>

          <LinePanel
            title={expectedTitle}
            className={cn("lg:order-1", mobilePanel !== "expected" && "hidden lg:block")}
            lines={lines}
            highlight={highlight}
            emptyText="This document has no lines."
            onSelect={canScan ? onSelectLine : undefined}
          />
          <LinePanel
            title={doneTitle}
            className={cn("lg:order-3", mobilePanel !== "done" && "hidden lg:block")}
            lines={doneLines}
            highlight={highlight}
            emptyText={doneEmptyText}
          />
        </div>
      )}

      {children}
    </div>
  );
}

interface LinePanelProps {
  title: string;
  lines: StockFlowLine[];
  highlight: StockFlowHighlight | null;
  emptyText: string;
  className?: string;
  onSelect?: (line: StockFlowLine) => void;
}

function LinePanel({ title, lines, highlight, emptyText, className, onSelect }: LinePanelProps) {
  return (
    <section aria-label={title} className={cn("border border-border bg-card", className)}>
      <div className="border-b border-border-subtle px-4 py-2.5">
        <MicroLabel>{title}</MicroLabel>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground md:text-ui">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {lines.map((line) => (
            <li key={line.id} className="relative flex items-center gap-3 px-4 py-2.5">
              {highlight?.lineId === line.id && (
                <motion.span
                  key={highlight.key}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-primary-light"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: DURATION.slow, ease: EASE_STANDARD, delay: HIGHLIGHT_DELAY_SECONDS }}
                />
              )}
              <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm leading-tight font-medium md:text-ui">{line.item.name}</span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {line.queued ? <StatusBadge status="queued" label={`Queued +${line.queued}`} /> : null}
                    <StatusBadge status={lineState(line)} />
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
                <QuantityProgress value={line.done} total={line.target} />
              </div>
              {onSelect && remainingQuantity(line) > 0 && (
                <Button variant="outline" size="sm" className="relative shrink-0" onClick={() => onSelect(line)}>
                  Select
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StockFlowSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
