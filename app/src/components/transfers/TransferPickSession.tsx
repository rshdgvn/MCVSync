import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Truck, TriangleAlert } from "lucide-react";
import { insufficientStockOf, transferStatusKey, type PickPayload } from "@/api/transfers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailLoadError } from "@/components/DetailLoadError";
import type { ScanEvent } from "@/components/ScanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChooseLineDialog } from "@/components/stock-flow/ChooseLineDialog";
import { StockFlowShell, StockFlowSkeleton, type StockFlowHighlight } from "@/components/stock-flow/StockFlowShell";
import { summarizeLines, type StockFlowLine } from "@/components/stock-flow/stockFlowLines";
import { PickLineDialog } from "@/components/transfers/PickLineDialog";
import { ShortageDialog } from "@/components/transfers/ShortageDialog";
import { canFulfillTransfer, isFullyPicked } from "@/components/transfers/transferRules";
import { useMeQuery } from "@/hooks/useAuth";
import { useInventoryChannels } from "@/hooks/useInventoryChannels";
import { useMatchPickMutation, usePickStockMutation, useShipTransferMutation, useTransferQuery } from "@/hooks/useTransfers";
import { getErrorMessage } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import { statusInfo } from "@/lib/status";
import { toast } from "@/stores/toast.store";
import type { Batch } from "@/types/inventory";
import type { InsufficientStock } from "@/types/transfer";

interface PickingState {
  line: StockFlowLine;
  remaining: number;
  suggestedBatch: Batch | null;
}

export function TransferPickSession({ transferId }: { transferId: number }) {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const transferQuery = useTransferQuery(transferId);
  const matchMutation = useMatchPickMutation(transferId);
  const pickMutation = usePickStockMutation(transferId);
  const shipMutation = useShipTransferMutation(transferId);
  const [picking, setPicking] = useState<PickingState | null>(null);
  const [shortage, setShortage] = useState<InsufficientStock | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmingShip, setConfirmingShip] = useState(false);
  const [highlight, setHighlight] = useState<StockFlowHighlight | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
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

  const lines: StockFlowLine[] = transfer.items.map((line) => ({
    id: line.id,
    item: line.item,
    target: line.quantity_requested,
    done: line.quantity_picked,
  }));
  const summary = summarizeLines(lines);
  const canPick = canFulfillTransfer(user, transfer);
  const readyToShip = canPick && isFullyPicked(transfer);
  const sheetOpen = picking !== null || shortage !== null || choosing || confirmingShip;
  const shortageItem = shortage ? (lines.find((line) => line.item.id === shortage.item_id)?.item ?? null) : null;

  async function runMatch(scan: { barcode: string } | { item_id: number }): Promise<boolean> {
    setScanError(null);
    try {
      const result = await matchMutation.mutateAsync(scan);
      if (result.status === "not_found") {
        setScanError(`${result.item.name} isn't on this transfer.`);
        return false;
      }
      const line = lines.find((candidate) => candidate.id === result.transfer_request_item.id);
      if (!line) {
        return false;
      }
      pickMutation.reset();
      setPicking({ line, remaining: result.remaining_quantity, suggestedBatch: result.suggested_batch });
      return true;
    } catch (error) {
      const insufficient = insufficientStockOf(error);
      if (insufficient) {
        setShortage(insufficient);
      } else {
        setScanError(getErrorMessage(error));
      }
      return false;
    }
  }

  function handleScan(scan: ScanEvent) {
    if (!canPick || sheetOpen || matchMutation.isPending) {
      return false;
    }
    return runMatch({ barcode: scan.value });
  }

  function chooseLine(line: StockFlowLine) {
    setChoosing(false);
    void runMatch({ item_id: line.item.id });
  }

  function submitPick(payload: PickPayload) {
    return pickMutation.mutateAsync(payload, {
      onSuccess: (line) => {
        toast.success(`Picked ${formatQuantity(payload.quantity, line.item.unit?.code)} of ${line.item.name}.`);
        setHighlight({ lineId: line.id, key: Date.now() });
        setPicking(null);
      },
      onError: (error) => {
        const insufficient = insufficientStockOf(error);
        if (insufficient) {
          setPicking(null);
          setShortage(insufficient);
        }
      },
    });
  }

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
            disabled={!readyToShip}
            title={readyToShip ? undefined : "Pick every line in full first"}
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
      notice={notice}
      lines={lines}
      expectedTitle="Items to Pick"
      expectedTabLabel="To Pick"
      doneTitle="Picked Items"
      doneTabLabel="Picked"
      doneEmptyText="Nothing picked yet. Scan an item to start."
      scanTitle="Scan Items to Pick"
      canScan={canPick}
      onScan={handleScan}
      onChooseItem={() => setChoosing(true)}
      onSelectLine={chooseLine}
      scanError={scanError}
      highlight={highlight}
    >
      {picking && (
        <PickLineDialog
          key={picking.line.id}
          line={picking.line}
          remaining={picking.remaining}
          suggestedBatch={picking.suggestedBatch}
          fulfillingBranchId={transfer.fulfilling_branch.id}
          isPending={pickMutation.isPending}
          serverError={pickMutation.error}
          onSubmit={submitPick}
          onClose={() => setPicking(null)}
        />
      )}

      {shortage && (
        <ShortageDialog
          shortage={shortage}
          item={shortageItem}
          transferNumber={transfer.transfer_number}
          fulfillingBranchId={transfer.fulfilling_branch.id}
          onClose={() => setShortage(null)}
        />
      )}

      {choosing && (
        <ChooseLineDialog
          lines={lines}
          description="Items still to pick on this transfer."
          onSelect={chooseLine}
          onClose={() => setChoosing(false)}
        />
      )}

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
