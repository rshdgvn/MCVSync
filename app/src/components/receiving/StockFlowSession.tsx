import { useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, ListChecks, TriangleAlert } from "lucide-react";
import type { ReceivingCompletion, ReceivingLine, ReceivingReferenceType } from "@/api/receiving";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailHeader } from "@/components/DetailHeader";
import { DetailLoadError } from "@/components/DetailLoadError";
import { EmptyState } from "@/components/EmptyState";
import { FormError } from "@/components/FormError";
import { MicroLabel } from "@/components/MicroLabel";
import { QuantityProgress } from "@/components/QuantityProgress";
import { ScanInput, type ScanEvent } from "@/components/ScanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { TabBar } from "@/components/TabBar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChooseLineDialog } from "@/components/receiving/ChooseLineDialog";
import { NotOnDocumentDialog } from "@/components/receiving/NotOnDocumentDialog";
import { ReceiveLineDialog } from "@/components/receiving/ReceiveLineDialog";
import {
  lineState,
  overLines,
  remainingQuantity,
  shortLines,
  summarizeLines,
} from "@/components/receiving/receivingLineState";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import {
  useCompleteReceivingMutation,
  useLogNotOnDocumentMutation,
  useMatchReceivingScanMutation,
  useReceiveLineMutation,
  useReceivingSessionQuery,
} from "@/hooks/useReceiving";
import { getErrorMessage } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast.store";
import type { Item } from "@/types/inventory";

type MobilePanel = "expected" | "confirmed";

const HIGHLIGHT_DELAY_SECONDS = 0.6;

interface StockFlowSessionProps {
  referenceType: ReceivingReferenceType;
  referenceId: number;
  backTo: LinkProps["to"];
  backLabel: string;
  documentLink: Pick<LinkProps, "to" | "params">;
  documentLabel: string;
}

export function StockFlowSession({
  referenceType,
  referenceId,
  backTo,
  backLabel,
  documentLink,
  documentLabel,
}: StockFlowSessionProps) {
  const sessionQuery = useReceivingSessionQuery(referenceType, referenceId);
  const matchMutation = useMatchReceivingScanMutation(referenceType, referenceId);
  const receiveMutation = useReceiveLineMutation(referenceType, referenceId);
  const notOnDocumentMutation = useLogNotOnDocumentMutation(referenceType, referenceId);
  const completeMutation = useCompleteReceivingMutation(referenceType, referenceId);
  const [receiving, setReceiving] = useState<{ line: ReceivingLine; remaining: number } | null>(null);
  const [notOnDocument, setNotOnDocument] = useState<Item | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [completion, setCompletion] = useState<ReceivingCompletion | null>(null);
  const [highlight, setHighlight] = useState<{ lineId: number; key: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("expected");
  const session = sessionQuery.data;
  useInventoryChannels(session ? [session.document.branch.id] : []);

  if (sessionQuery.isPending) {
    return <StockFlowSessionSkeleton />;
  }

  if (sessionQuery.isError || !session) {
    return (
      <DetailLoadError
        error={sessionQuery.error}
        onRetry={() => void sessionQuery.refetch()}
        backTo={backTo}
        backLabel={backLabel}
        entityLabel={documentLabel}
      />
    );
  }

  const { document, lines, discrepancies } = session;
  const summary = summarizeLines(lines);
  const confirmedLines = lines.filter((line) => line.received > 0);
  const sheetOpen = receiving !== null || notOnDocument !== null || choosing || confirmingComplete;
  const canReceive = document.isReceivable && completion === null;
  const unresolvedDiscrepancies = discrepancies.filter((discrepancy) => !discrepancy.resolved);

  async function runMatch(scan: { barcode: string } | { item_id: number }): Promise<boolean> {
    setScanError(null);
    try {
      const result = await matchMutation.mutateAsync(scan);
      if (result.status === "found") {
        receiveMutation.reset();
        setReceiving({ line: result.line, remaining: result.remaining });
        return true;
      }
      notOnDocumentMutation.reset();
      setNotOnDocument(result.item);
      return false;
    } catch (error) {
      setScanError(getErrorMessage(error));
      return false;
    }
  }

  function handleScan(scan: ScanEvent) {
    if (!canReceive || sheetOpen || matchMutation.isPending) {
      return false;
    }
    return runMatch({ barcode: scan.value });
  }

  function chooseLine(line: ReceivingLine) {
    setChoosing(false);
    void runMatch({ item_id: line.item.id });
  }

  function confirmReceipt(payload: Parameters<typeof receiveMutation.mutateAsync>[0]) {
    return receiveMutation.mutateAsync(payload, {
      onSuccess: (line) => {
        toast.success(`Received ${formatQuantity(payload.quantity, line.item.unit?.code)} of ${line.item.name}.`);
        setHighlight({ lineId: line.id, key: Date.now() });
        setReceiving(null);
      },
    });
  }

  function logNotOnDocument(payload: Parameters<typeof notOnDocumentMutation.mutateAsync>[0]) {
    return notOnDocumentMutation.mutateAsync(payload, {
      onSuccess: () => {
        toast.info("Discrepancy logged.");
        setNotOnDocument(null);
      },
    });
  }

  function confirmComplete() {
    return completeMutation.mutateAsync(undefined, {
      onSuccess: (result) => {
        setConfirmingComplete(false);
        setCompletion(result);
      },
    });
  }

  const completeButton = (
    <Button
      disabled={!canReceive}
      onClick={() => {
        completeMutation.reset();
        setConfirmingComplete(true);
      }}
    >
      <ClipboardCheck />
      Complete Receiving
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DetailHeader
          backTo={backTo}
          backLabel={backLabel}
          eyebrow="Receiving Stock"
          title={<span className="font-mono">{document.number}</span>}
          meta={
            <>
              <StatusBadge status={document.status} />
              <span>{document.counterparty}</span>
              <span>{document.branch.name}</span>
            </>
          }
          primaryAction={completion === null && completeButton}
        />
      </div>

      <section aria-label="Receiving progress" className="flex flex-col gap-2 border border-border bg-card px-4 py-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-extrabold text-primary">{summary.fullyReceived}</span>
          <span className="font-mono text-base font-bold text-faint">/ {summary.total}</span>
          <span className="ml-1 text-xs text-muted-foreground">lines received</span>
        </div>
        <QuantityProgress value={summary.fullyReceived} total={summary.total} className="md:max-w-64 md:flex-1" />
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status="complete" label={`${summary.matched} matched`} />
          <StatusBadge status="partial" label={`${summary.short} short`} />
          <StatusBadge status="over" label={`${summary.over} over`} />
        </div>
      </section>

      {!document.isReceivable && completion === null && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            This {documentLabel.toLowerCase()} is {document.status.replaceAll("_", " ")} and isn't open for receiving.
          </AlertDescription>
        </Alert>
      )}

      {completion ? (
        <ReceivingResult completion={completion} documentNumber={document.number} documentLink={documentLink} backTo={backTo} backLabel={backLabel} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:items-start">
          <section
            aria-label="Scan panel"
            className="sticky top-0 z-10 -mx-4 border-y border-border bg-card px-4 py-3 md:mx-0 md:border-x lg:static lg:order-2 lg:p-4"
          >
            <MicroLabel className="mb-2">Scan Incoming Items</MicroLabel>
            {canReceive ? (
              <div className="flex flex-col gap-2">
                <ScanInput onScan={handleScan} />
                <FormError message={scanError} />
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setChoosing(true)}>
                  <ListChecks />
                  No barcode? Choose item
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground md:text-ui">Scanning is off for this document.</p>
            )}
            {unresolvedDiscrepancies.length > 0 && (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <MicroLabel className="mb-1.5">Open Discrepancies ({unresolvedDiscrepancies.length})</MicroLabel>
                <ul className="flex flex-col gap-1">
                  {unresolvedDiscrepancies.map((discrepancy) => (
                    <li key={discrepancy.id} className="flex items-center gap-2 text-xs">
                      <StatusBadge status={discrepancy.type} />
                      <span className="min-w-0 flex-1 truncate">{discrepancy.item?.name ?? "Unknown item"}</span>
                      {discrepancy.scanned_quantity !== null && (
                        <span className="font-mono text-muted-foreground">{discrepancy.scanned_quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="lg:hidden">
            <TabBar
              ariaLabel="Session lines"
              value={mobilePanel}
              onChange={setMobilePanel}
              tabs={[
                { value: "expected", label: `Expected (${lines.length})` },
                { value: "confirmed", label: `Confirmed (${confirmedLines.length})` },
              ]}
            />
          </div>

          <LinePanel
            title="Expected Items"
            className={cn("lg:order-1", mobilePanel !== "expected" && "hidden lg:block")}
            lines={lines}
            highlight={highlight}
            emptyText="This document has no lines."
            onSelect={canReceive ? chooseLine : undefined}
          />
          <LinePanel
            title="Confirmed Items"
            className={cn("lg:order-3", mobilePanel !== "confirmed" && "hidden lg:block")}
            lines={confirmedLines}
            highlight={highlight}
            emptyText="Nothing received yet. Scan an item to start."
          />
        </div>
      )}

      {receiving && (
        <ReceiveLineDialog
          key={receiving.line.id}
          line={receiving.line}
          remaining={receiving.remaining}
          isPending={receiveMutation.isPending}
          serverError={receiveMutation.error}
          onSubmit={confirmReceipt}
          onClose={() => setReceiving(null)}
        />
      )}

      {notOnDocument && (
        <NotOnDocumentDialog
          item={notOnDocument}
          documentNumber={document.number}
          isPending={notOnDocumentMutation.isPending}
          serverError={notOnDocumentMutation.error}
          onSubmit={logNotOnDocument}
          onClose={() => setNotOnDocument(null)}
        />
      )}

      {choosing && <ChooseLineDialog lines={lines} onSelect={chooseLine} onClose={() => setChoosing(false)} />}

      <ConfirmDialog
        open={confirmingComplete}
        onOpenChange={(open) => !open && setConfirmingComplete(false)}
        title="Complete Receiving?"
        description={<CompleteSummary lines={lines} documentNumber={document.number} />}
        confirmLabel="Complete Receiving"
        isPending={completeMutation.isPending}
        error={completeMutation.isError ? getErrorMessage(completeMutation.error) : null}
        onConfirm={confirmComplete}
      />
    </div>
  );
}

interface LinePanelProps {
  title: string;
  lines: ReceivingLine[];
  highlight: { lineId: number; key: number } | null;
  emptyText: string;
  className?: string;
  onSelect?: (line: ReceivingLine) => void;
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
                  <StatusBadge status={lineState(line)} />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
                <QuantityProgress value={line.received} total={line.expected} />
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

function CompleteSummary({ lines, documentNumber }: { lines: ReceivingLine[]; documentNumber: string }) {
  const short = shortLines(lines);
  const over = overLines(lines);

  if (short.length === 0 && over.length === 0) {
    return (
      <>
        Every line on <span className="font-mono">{documentNumber}</span> matches what was ordered. It will close.
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {short.length > 0 && (
        <div>
          <p className="mb-1">These lines are short. Each shortfall is logged and the document stays open for the next delivery:</p>
          <ul className="flex flex-col gap-0.5">
            {short.map((line) => (
              <li key={line.id} className="flex justify-between gap-3">
                <span className="truncate">{line.item.name}</span>
                <span className="shrink-0 font-mono">
                  {line.received} / {line.expected}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {over.length > 0 && (
        <p>
          {over.length} {over.length === 1 ? "line was" : "lines were"} over-received and already logged. The document stays
          open until they're reviewed.
        </p>
      )}
    </div>
  );
}

interface ReceivingResultProps {
  completion: ReceivingCompletion;
  documentNumber: string;
  documentLink: Pick<LinkProps, "to" | "params">;
  backTo: LinkProps["to"];
  backLabel: string;
}

function ReceivingResult({ completion, documentNumber, documentLink, backTo, backLabel }: ReceivingResultProps) {
  const short = shortLines(completion.lines).length;
  const over = overLines(completion.lines).length;
  const openReasons = [
    short > 0 && `${short} ${short === 1 ? "shortfall" : "shortfalls"} logged`,
    over > 0 && `${over} ${over === 1 ? "line" : "lines"} over-received need review`,
  ].filter(Boolean);

  return (
    <div className="border border-border bg-card">
      <EmptyState
        icon={completion.isClosed ? CheckCircle2 : TriangleAlert}
        title={completion.isClosed ? "Stock Received" : `Still open: ${openReasons.join(", ")}`}
        description={
          completion.isClosed
            ? `${documentNumber} is fully received and closed.`
            : `${documentNumber} stays open. Receive the rest when the next delivery arrives.`
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" render={<Link {...documentLink} />}>
              View {documentNumber}
            </Button>
            <Button size="sm" render={<Link to={backTo} />}>
              Back to {backLabel}
            </Button>
          </div>
        }
      />
    </div>
  );
}

function StockFlowSessionSkeleton() {
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
