import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, TriangleAlert } from "lucide-react";
import { cofFulfillmentCacheKey, cofPickScope } from "@/api/cofFulfillment";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailLoadError } from "@/components/DetailLoadError";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { canPickCof } from "@/components/issuing-stock/cofPickRules";
import { ShortLineList } from "@/components/stock-flow/ShortLineList";
import { StockFlowOfflineNotice } from "@/components/stock-flow/StockFlowOfflineNotice";
import { StockFlowShell, StockFlowSkeleton } from "@/components/stock-flow/StockFlowShell";
import {
  shortLines,
  summarizeLines,
  withQueuedQuantities,
  type StockFlowLine,
  type StockFlowScan,
} from "@/components/stock-flow/stockFlowLines";
import { usePickFlow, type PickMatch } from "@/components/stock-flow/usePickFlow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import {
  useCofFulfillmentQuery,
  useCompleteCofPickingMutation,
  useMatchCofPickMutation,
  usePickCofStockMutation,
} from "@/hooks/useCofFulfillment";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScopeQueue } from "@/hooks/usePendingMutations";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { statusInfo } from "@/lib/status";
import { toast } from "@/stores/toast.store";
import type { CofFulfillmentDetail } from "@/types/clientOrderForm";
import type { User } from "@/types/user";

const QUEUE_LINK = { to: "/purchasing/issuing-stock", search: { tab: "client_orders" } } as const;

type PickingOutcome = { ready: true } | { ready: false; short: number };

export function CofPickSession({ cofId }: { cofId: number }) {
  const user = useMeQuery().data;
  const cofQuery = useCofFulfillmentQuery(cofId);
  const cof = cofQuery.data;
  useInventoryChannels(cof ? [cof.branch.id] : []);

  if (cofQuery.isPending) {
    return <StockFlowSkeleton />;
  }

  if (cofQuery.isError || !cof || !user) {
    return (
      <DetailLoadError
        error={cofQuery.error}
        onRetry={() => void cofQuery.refetch()}
        backTo="/purchasing/issuing-stock"
        backLabel="Issuing Stock"
        entityLabel="Client Order"
      />
    );
  }

  return <CofPickContent cof={cof} user={user} />;
}

function CofPickContent({ cof, user }: { cof: CofFulfillmentDetail; user: User }) {
  const matchMutation = useMatchCofPickMutation(cof.id);
  const pickMutation = usePickCofStockMutation(cof.id);
  const completeMutation = useCompleteCofPickingMutation(cof.id);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [outcome, setOutcome] = useState<PickingOutcome | null>(null);
  const isOnline = useOnlineStatus();
  const queue = useScopeQueue(cofPickScope(cof.id));

  const lines = withQueuedQuantities(
    cof.items.map((line) => ({ id: line.id, item: line.item, target: line.quantity, done: line.quantity_picked })),
    queue.quantities,
  );
  const summary = summarizeLines(lines);
  const canPick = canPickCof(user, cof);
  const completeBlockedReason = !isOnline
    ? "Reconnect to complete picking"
    : queue.unsynced > 0
      ? "Wait for queued picks to sync"
      : undefined;

  async function match(scan: StockFlowScan): Promise<PickMatch> {
    const result = await matchMutation.mutateAsync(scan);
    return result.status === "not_found"
      ? { status: "not_found", itemName: result.item.name }
      : {
          status: "found",
          lineId: result.client_order_form_item.id,
          remaining: result.remaining_quantity,
          suggestedBatch: result.suggested_batch,
        };
  }

  const flow = usePickFlow({
    lines,
    documentNumber: cof.cof_number,
    documentKind: "order",
    fulfillingBranchId: cof.branch.id,
    canPick,
    isBlocked: confirmingComplete,
    match,
    isMatching: matchMutation.isPending,
    pickMutation,
    onPicked: (picked) => {
      if (!picked.queued && picked.data.order_status === "ready_for_delivery") {
        setOutcome({ ready: true });
      }
    },
  });

  function confirmComplete() {
    return completeMutation.mutateAsync(undefined, {
      onSuccess: (completed) => {
        if (completed.order_status === "ready_for_delivery") {
          toast.success(`${completed.cof_number} is ready for delivery.`);
          setOutcome({ ready: true });
        } else {
          const short = shortLines(lines).length;
          toast.info(`${completed.cof_number}: ${short} short ${short === 1 ? "line" : "lines"} sent to Sales for review.`);
          setOutcome({ ready: false, short });
        }
        setConfirmingComplete(false);
      },
    });
  }

  const finished = outcome ?? savedOutcome(cof, lines);

  return (
    <StockFlowShell
      backTo={QUEUE_LINK.to}
      backLabel="Issuing Stock"
      eyebrow="Pick Client Order"
      documentNumber={cof.cof_number}
      meta={
        <>
          <StatusBadge status={cof.order_status} />
          {cof.cancellation_requested && <StatusBadge status="cancellation_requested" />}
          <span>{cof.client_name}</span>
          <span>{cof.branch.name}</span>
          {cof.request_delivery_date && <span>Deliver by {formatDate(cof.request_delivery_date)}</span>}
        </>
      }
      primaryAction={
        canPick &&
        !finished && (
          <Button
            disabled={completeBlockedReason !== undefined}
            title={completeBlockedReason}
            onClick={() => {
              completeMutation.reset();
              setConfirmingComplete(true);
            }}
          >
            <ClipboardCheck />
            Complete Picking
          </Button>
        )
      }
      progress={{ finished: summary.finished, total: summary.total, label: "lines picked" }}
      chips={
        <>
          <StatusBadge status="complete" label={`${summary.matched} picked`} />
          <StatusBadge status="partial" label={`${summary.short} partial`} />
        </>
      }
      notice={
        <>
          <StockFlowOfflineNotice cacheKey={cofFulfillmentCacheKey(cof.id)} unsynced={queue.unsynced} />
          <PickNotice cof={cof} canPick={canPick} />
        </>
      }
      result={finished && <PickingResult outcome={finished} documentNumber={cof.cof_number} />}
      lines={lines}
      expectedTitle="Items to Pick"
      expectedTabLabel="To Pick"
      doneTitle="Picked Items"
      doneTabLabel="Picked"
      doneEmptyText="Nothing picked yet. Scan an item to start."
      scanTitle="Scan Items to Pick"
      canScan={canPick && !finished}
      onScan={flow.handleScan}
      onChooseItem={flow.openChooser}
      onSelectLine={flow.chooseLine}
      scanError={flow.scanError}
      highlight={flow.highlight}
    >
      {flow.dialogs}

      <ConfirmDialog
        open={confirmingComplete}
        onOpenChange={(open) => !open && setConfirmingComplete(false)}
        title="Complete Picking?"
        description={<CompleteSummary lines={lines} documentNumber={cof.cof_number} />}
        confirmLabel="Complete Picking"
        isPending={completeMutation.isPending}
        error={completeMutation.isError ? getErrorMessage(completeMutation.error) : null}
        onConfirm={confirmComplete}
      />
    </StockFlowShell>
  );
}

function savedOutcome(cof: CofFulfillmentDetail, lines: StockFlowLine[]): PickingOutcome | null {
  if (cof.order_status === "ready_for_delivery") {
    return { ready: true };
  }
  if (cof.order_status === "processing" && cof.picking_completed_at !== null) {
    return { ready: false, short: shortLines(lines).length };
  }
  return null;
}

function PickNotice({ cof, canPick }: { cof: CofFulfillmentDetail; canPick: boolean }) {
  if (canPick || cof.picking_completed_at !== null || cof.order_status === "ready_for_delivery") {
    return null;
  }
  if (cof.order_status !== "processing") {
    return <WarningNotice>{`This order is ${statusInfo(cof.order_status).label.toLowerCase()} and isn't open for picking.`}</WarningNotice>;
  }
  if (cof.cancellation_requested) {
    return (
      <WarningNotice>
        The client asked to cancel this order. Picking is paused until Sales or Purchasing confirms or declines the request.
      </WarningNotice>
    );
  }
  return <WarningNotice>{`Only ${cof.branch.name} picks this order.`}</WarningNotice>;
}

function WarningNotice({ children }: { children: string }) {
  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function CompleteSummary({ lines, documentNumber }: { lines: StockFlowLine[]; documentNumber: string }) {
  const short = shortLines(lines);

  if (short.length === 0) {
    return (
      <p>
        Every line on <span className="font-mono">{documentNumber}</span> is fully picked. It moves to Ready for Delivery.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1">
        These lines are short. Each shortfall is logged and Sales decides whether to dispatch what was picked or hold the order:
      </p>
      <ShortLineList lines={short} />
    </div>
  );
}

function PickingResult({ outcome, documentNumber }: { outcome: PickingOutcome; documentNumber: string }) {
  return (
    <div className="border border-border bg-card">
      <EmptyState
        icon={outcome.ready ? CheckCircle2 : TriangleAlert}
        title={outcome.ready ? "Ready for Delivery" : "Waiting for Sales dispatch decision"}
        description={
          outcome.ready
            ? `${documentNumber} is fully picked. Logistics can schedule the delivery.`
            : `Picking is complete with ${outcome.short} short ${outcome.short === 1 ? "line" : "lines"}. Sales decides whether to dispatch what was picked or hold ${documentNumber}.`
        }
        action={
          <Button size="sm" render={<Link {...QUEUE_LINK} />}>
            Back to Issuing Stock
          </Button>
        }
      />
    </div>
  );
}
