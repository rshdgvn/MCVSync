import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Truck, TriangleAlert } from "lucide-react";
import { pickScope, transferCacheKey, transferStatusKey } from "@/api/transfers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailLoadError } from "@/components/DetailLoadError";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StockFlowOfflineNotice } from "@/components/stock-flow/StockFlowOfflineNotice";
import { StockFlowShell, StockFlowSkeleton } from "@/components/stock-flow/StockFlowShell";
import { summarizeLines, withQueuedQuantities, type StockFlowScan } from "@/components/stock-flow/stockFlowLines";
import { usePickFlow, type PickMatch } from "@/components/stock-flow/usePickFlow";
import { canFulfillTransfer, isFullyPicked } from "@/components/transfers/transferRules";
import { useMeQuery } from "@/hooks/useAuth";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScopeQueue } from "@/hooks/usePendingMutations";
import { useMatchPickMutation, usePickStockMutation, useShipTransferMutation, useTransferQuery } from "@/hooks/useTransfers";
import { getErrorMessage } from "@/lib/errors";
import { statusInfo } from "@/lib/status";
import { toast } from "@/stores/toast.store";
import type { TransferDetail } from "@/types/transfer";
import type { User } from "@/types/user";

export function TransferPickSession({ transferId }: { transferId: number }) {
  const user = useMeQuery().data;
  const transferQuery = useTransferQuery(transferId);
  const transfer = transferQuery.data;
  useInventoryChannels(transfer ? [transfer.fulfilling_branch.id] : []);

  if (transferQuery.isPending) {
    return <StockFlowSkeleton />;
  }

  if (transferQuery.isError || !transfer || !user) {
    return (
      <DetailLoadError
        error={transferQuery.error}
        onRetry={() => void transferQuery.refetch()}
        backTo="/purchasing/transfers"
        backLabel="Transfer Orders"
        entityLabel="Transfer Request"
      />
    );
  }

  return <TransferPickContent transfer={transfer} user={user} />;
}

function TransferPickContent({ transfer, user }: { transfer: TransferDetail; user: User }) {
  const navigate = useNavigate();
  const transferId = transfer.id;
  const matchMutation = useMatchPickMutation(transferId);
  const pickMutation = usePickStockMutation(transferId);
  const shipMutation = useShipTransferMutation(transferId);
  const [confirmingShip, setConfirmingShip] = useState(false);
  const isOnline = useOnlineStatus();
  const queue = useScopeQueue(pickScope(transferId));

  const lines = withQueuedQuantities(
    transfer.items.map((line) => ({
      id: line.id,
      item: line.item,
      target: line.quantity_requested,
      done: line.quantity_picked,
    })),
    queue.quantities,
  );
  const summary = summarizeLines(lines);
  const canPick = canFulfillTransfer(user, transfer);
  const readyToShip = canPick && isFullyPicked(transfer);
  const shipBlockedReason = !readyToShip
    ? "Pick every line in full first"
    : !isOnline
      ? "Reconnect to mark this transfer in transit"
      : queue.unsynced > 0
        ? "Wait for queued picks to sync"
        : undefined;

  async function match(scan: StockFlowScan): Promise<PickMatch> {
    const result = await matchMutation.mutateAsync(scan);
    return result.status === "not_found"
      ? { status: "not_found", itemName: result.item.name }
      : {
          status: "found",
          lineId: result.transfer_request_item.id,
          remaining: result.remaining_quantity,
          suggestedBatch: result.suggested_batch,
        };
  }

  const flow = usePickFlow({
    lines,
    documentNumber: transfer.transfer_number,
    documentKind: "transfer",
    fulfillingBranchId: transfer.fulfilling_branch.id,
    canPick,
    isBlocked: confirmingShip,
    match,
    isMatching: matchMutation.isPending,
    pickMutation,
  });

  function confirmShip() {
    return shipMutation.mutateAsync(undefined, {
      onSuccess: (shipped) => {
        toast.success(`${shipped.transfer_number} is in transit to ${shipped.requesting_branch.name}.`);
        void navigate({ to: "/purchasing/transfers/$transferId", params: { transferId: String(shipped.id) } });
      },
    });
  }

  const statusKey = transferStatusKey(transfer.status);
  const notice = !canPick && (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertDescription>
        {transfer.status === "pending"
          ? `Only ${transfer.fulfilling_branch.name} picks this transfer.`
          : `This transfer is ${statusInfo(statusKey).label.toLowerCase()} and isn't open for picking.`}
      </AlertDescription>
    </Alert>
  );

  return (
    <StockFlowShell
      backTo="/purchasing/transfers"
      backLabel="Transfer Orders"
      eyebrow="Prepare Transfer"
      documentNumber={transfer.transfer_number}
      meta={
        <>
          <StatusBadge status={statusKey} />
          <span>To {transfer.requesting_branch.name}</span>
          <span>From {transfer.fulfilling_branch.name}</span>
        </>
      }
      primaryAction={
        canPick && (
          <Button
            disabled={shipBlockedReason !== undefined}
            title={shipBlockedReason}
            onClick={() => {
              shipMutation.reset();
              setConfirmingShip(true);
            }}
          >
            <Truck />
            Confirm & Mark In Transit
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
          <StockFlowOfflineNotice cacheKey={transferCacheKey(transferId)} unsynced={queue.unsynced} />
          {notice}
        </>
      }
      lines={lines}
      expectedTitle="Items to Pick"
      expectedTabLabel="To Pick"
      doneTitle="Picked Items"
      doneTabLabel="Picked"
      doneEmptyText="Nothing picked yet. Scan an item to start."
      scanTitle="Scan Items to Pick"
      canScan={canPick}
      onScan={flow.handleScan}
      onChooseItem={flow.openChooser}
      onSelectLine={flow.chooseLine}
      scanError={flow.scanError}
      highlight={flow.highlight}
    >
      {flow.dialogs}

      <ConfirmDialog
        open={confirmingShip}
        onOpenChange={(open) => !open && setConfirmingShip(false)}
        title="Mark In Transit?"
        description={
          <>
            <span className="font-mono">{transfer.transfer_number}</span> moves to In Transit and{" "}
            {transfer.requesting_branch.name} can receive it. Picks can't be changed after this.
          </>
        }
        confirmLabel="Confirm & Mark In Transit"
        isPending={shipMutation.isPending}
        error={shipMutation.isError ? getErrorMessage(shipMutation.error) : null}
        onConfirm={confirmShip}
      />
    </StockFlowShell>
  );
}
