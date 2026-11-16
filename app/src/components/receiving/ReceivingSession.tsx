import { useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, TriangleAlert } from "lucide-react";
import type { ReceivingCompletion, ReceivingReferenceType } from "@/api/receiving";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailLoadError } from "@/components/DetailLoadError";
import { EmptyState } from "@/components/EmptyState";
import { MicroLabel } from "@/components/MicroLabel";
import { type ScanEvent } from "@/components/ScanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NotOnDocumentDialog } from "@/components/receiving/NotOnDocumentDialog";
import { ReceiveLineDialog } from "@/components/receiving/ReceiveLineDialog";
import { ChooseLineDialog } from "@/components/stock-flow/ChooseLineDialog";
import { StockFlowShell, StockFlowSkeleton, type StockFlowHighlight } from "@/components/stock-flow/StockFlowShell";
import { overLines, shortLines, summarizeLines, type StockFlowLine } from "@/components/stock-flow/stockFlowLines";
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
import { statusInfo } from "@/lib/status";
import { toast } from "@/stores/toast.store";
import type { Item } from "@/types/inventory";

interface ReceivingSessionProps {
  referenceType: ReceivingReferenceType;
  referenceId: number;
  backTo: LinkProps["to"];
  backLabel: string;
  documentLink: Pick<LinkProps, "to" | "params">;
  documentLabel: string;
}

export function ReceivingSession({
  referenceType,
  referenceId,
  backTo,
  backLabel,
  documentLink,
  documentLabel,
}: ReceivingSessionProps) {
  const sessionQuery = useReceivingSessionQuery(referenceType, referenceId);
  const matchMutation = useMatchReceivingScanMutation(referenceType, referenceId);
  const receiveMutation = useReceiveLineMutation(referenceType, referenceId);
  const notOnDocumentMutation = useLogNotOnDocumentMutation(referenceType, referenceId);
  const completeMutation = useCompleteReceivingMutation(referenceType, referenceId);
  const [receiving, setReceiving] = useState<{ line: StockFlowLine; remaining: number } | null>(null);
  const [notOnDocument, setNotOnDocument] = useState<Item | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [completion, setCompletion] = useState<ReceivingCompletion | null>(null);
  const [highlight, setHighlight] = useState<StockFlowHighlight | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const session = sessionQuery.data;
  useInventoryChannels(session ? [session.document.branch.id] : []);

  if (sessionQuery.isPending) {
    return <StockFlowSkeleton />;
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

  function chooseLine(line: StockFlowLine) {
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

  return (
    <StockFlowShell
      backTo={backTo}
      backLabel={backLabel}
      eyebrow="Receiving Stock"
      documentNumber={document.number}
      meta={
        <>
          <StatusBadge status={document.statusKey} />
          <span>{document.counterparty}</span>
          <span>{document.branch.name}</span>
        </>
      }
      primaryAction={
        completion === null && (
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
        )
      }
      progress={{ finished: summary.finished, total: summary.total, label: "lines received" }}
      chips={
        <>
          <StatusBadge status="complete" label={`${summary.matched} matched`} />
          <StatusBadge status="partial" label={`${summary.short} short`} />
          <StatusBadge status="over" label={`${summary.over} over`} />
        </>
      }
      notice={
        !document.isReceivable &&
        completion === null && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              This {documentLabel.toLowerCase()} is {statusInfo(document.statusKey).label.toLowerCase()} and isn't open for
              receiving.
            </AlertDescription>
          </Alert>
        )
      }
      result={
        completion && (
          <ReceivingResult
            completion={completion}
            documentNumber={document.number}
            documentLink={documentLink}
            backTo={backTo}
            backLabel={backLabel}
          />
        )
      }
      lines={lines}
      expectedTitle="Expected Items"
      expectedTabLabel="Expected"
      doneTitle="Confirmed Items"
      doneTabLabel="Confirmed"
      doneEmptyText="Nothing received yet. Scan an item to start."
      scanTitle="Scan Incoming Items"
      canScan={canReceive}
      onScan={handleScan}
      onChooseItem={() => setChoosing(true)}
      onSelectLine={chooseLine}
      scanError={scanError}
      highlight={highlight}
      scanAside={
        unresolvedDiscrepancies.length > 0 && (
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
        )
      }
    >
      {receiving && (
        <ReceiveLineDialog
          key={receiving.line.id}
          line={receiving.line}
          remaining={receiving.remaining}
          targetLabel={referenceType === "transfer_request" ? "Shipped" : "Ordered"}
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

      {choosing && (
        <ChooseLineDialog
          lines={lines}
          description="Items still expected on this document."
          onSelect={chooseLine}
          onClose={() => setChoosing(false)}
        />
      )}

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
    </StockFlowShell>
  );
}

function CompleteSummary({ lines, documentNumber }: { lines: StockFlowLine[]; documentNumber: string }) {
  const short = shortLines(lines);
  const over = overLines(lines);

  if (short.length === 0 && over.length === 0) {
    return (
      <>
        Every line on <span className="font-mono">{documentNumber}</span> matches what was expected. It will close.
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
                  {line.done} / {line.target}
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
