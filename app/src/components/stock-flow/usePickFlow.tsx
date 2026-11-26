import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { insufficientStockOf, type PickPayload } from "@/api/transfers";
import type { ScanEvent } from "@/components/ScanInput";
import { ChooseLineDialog } from "@/components/stock-flow/ChooseLineDialog";
import { PickLineDialog } from "@/components/stock-flow/PickLineDialog";
import { ShortageDialog } from "@/components/stock-flow/ShortageDialog";
import type { StockFlowHighlight } from "@/components/stock-flow/StockFlowShell";
import { matchScanLocally, type StockFlowLine, type StockFlowScan } from "@/components/stock-flow/stockFlowLines";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getErrorMessage } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import type { SendOutcome } from "@/lib/offline/sendOrQueue";
import { toast } from "@/stores/toast.store";
import type { Batch } from "@/types/inventory";
import type { InsufficientStock } from "@/types/transfer";

export type PickMatch =
  | { status: "found"; lineId: number; remaining: number; suggestedBatch: Batch | null }
  | { status: "not_found"; itemName: string };

export interface PickVariables {
  payload: PickPayload;
  lineId: number;
  label: string;
}

interface PickingState {
  line: StockFlowLine;
  remaining: number;
  suggestedBatch: Batch | null;
}

interface PickFlowOptions<T> {
  lines: StockFlowLine[];
  documentNumber: string;
  documentKind: string;
  fulfillingBranchId: number;
  canPick: boolean;
  isBlocked: boolean;
  match: (scan: StockFlowScan) => Promise<PickMatch>;
  isMatching: boolean;
  pickMutation: UseMutationResult<SendOutcome<T>, Error, PickVariables>;
  onPicked?: (outcome: SendOutcome<T>) => void;
}

export function usePickFlow<T>({
  lines,
  documentNumber,
  documentKind,
  fulfillingBranchId,
  canPick,
  isBlocked,
  match,
  isMatching,
  pickMutation,
  onPicked,
}: PickFlowOptions<T>) {
  const isOnline = useOnlineStatus();
  const [picking, setPicking] = useState<PickingState | null>(null);
  const [shortage, setShortage] = useState<InsufficientStock | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [highlight, setHighlight] = useState<StockFlowHighlight | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const sheetOpen = picking !== null || shortage !== null || choosing;
  const shortageItem = shortage ? (lines.find((line) => line.item.id === shortage.item_id)?.item ?? null) : null;

  function openPick(line: StockFlowLine, remaining: number, suggestedBatch: Batch | null) {
    pickMutation.reset();
    setPicking({ line, remaining, suggestedBatch });
  }

  async function runMatch(scan: StockFlowScan): Promise<boolean> {
    setScanError(null);
    if (!isOnline) {
      const local = matchScanLocally(lines, scan);
      if (local.status === "found") {
        openPick(local.line, local.remaining, null);
        return true;
      }
      setScanError(`Barcode ${local.barcode ?? ""} isn't on this ${documentKind}'s saved copy.`);
      return false;
    }
    try {
      const result = await match(scan);
      if (result.status === "not_found") {
        setScanError(`${result.itemName} isn't on this ${documentKind}.`);
        return false;
      }
      const line = lines.find((candidate) => candidate.id === result.lineId);
      if (!line) {
        return false;
      }
      openPick(line, Math.max(0, result.remaining - (line.queued ?? 0)), result.suggestedBatch);
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
    if (!canPick || sheetOpen || isBlocked || isMatching) {
      return false;
    }
    return runMatch({ barcode: scan.value });
  }

  function chooseLine(line: StockFlowLine) {
    setChoosing(false);
    void runMatch({ item_id: line.item.id });
  }

  function submitPick(payload: PickPayload) {
    if (!picking) {
      return;
    }
    const { line } = picking;
    const amount = formatQuantity(payload.quantity, line.item.unit?.code);
    return pickMutation.mutateAsync(
      { payload, lineId: line.id, label: `Pick ${amount} of ${line.item.name} for ${documentNumber}` },
      {
        onSuccess: (outcome) => {
          if (outcome.queued) {
            toast.info(`Queued a pick of ${amount} of ${line.item.name}. It syncs when you're back online.`);
          } else {
            toast.success(`Picked ${amount} of ${line.item.name}.`);
          }
          setHighlight({ lineId: line.id, key: Date.now() });
          setPicking(null);
          onPicked?.(outcome);
        },
        onError: (error) => {
          const insufficient = insufficientStockOf(error);
          if (insufficient) {
            setPicking(null);
            setShortage(insufficient);
          }
        },
      },
    );
  }

  const dialogs = (
    <>
      {picking && (
        <PickLineDialog
          key={picking.line.id}
          line={picking.line}
          remaining={picking.remaining}
          suggestedBatch={picking.suggestedBatch}
          fulfillingBranchId={fulfillingBranchId}
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
          documentNumber={documentNumber}
          fulfillingBranchId={fulfillingBranchId}
          onClose={() => setShortage(null)}
        />
      )}

      {choosing && (
        <ChooseLineDialog
          lines={lines}
          description={`Items still to pick on this ${documentKind}.`}
          onSelect={chooseLine}
          onClose={() => setChoosing(false)}
        />
      )}
    </>
  );

  return {
    sheetOpen,
    scanError,
    highlight,
    handleScan,
    chooseLine,
    openChooser: () => setChoosing(true),
    dialogs,
  };
}
