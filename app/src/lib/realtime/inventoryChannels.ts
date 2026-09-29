import type { ReverbEcho } from "@/providers/EchoProvider";
import { handleLowStockThresholdCrossed, handleStockLevelChanged } from "./inventoryChannelHandlers";

interface ChannelEntry {
  refCount: number;
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<number, ChannelEntry>();

function channelName(branchId: number): string {
  return `branch.${branchId}.inventory`;
}

/**
 * Ref-counted so the same branch channel survives navigation between the
 * Items List, Item Detail, and Low Stock pages instead of leaving and
 * rejoining on every route change — the channel and its listeners are
 * only torn down once nothing on screen needs them anymore. The brief
 * setTimeout(0) grace period absorbs the unmount-then-mount gap of a
 * route transition landing on the same branch.
 */
export function acquireInventoryChannel(echo: ReverbEcho, branchId: number): () => void {
  let entry = entries.get(branchId);

  if (!entry) {
    echo
      .private(channelName(branchId))
      .listen(".StockLevelChanged", handleStockLevelChanged)
      .listen(".LowStockThresholdCrossed", handleLowStockThresholdCrossed);

    entry = { refCount: 0, teardownTimer: null };
    entries.set(branchId, entry);
  }

  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  entry.refCount += 1;

  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;

    const current = entries.get(branchId);
    if (!current) {
      return;
    }

    current.refCount -= 1;
    if (current.refCount > 0) {
      return;
    }

    current.teardownTimer = setTimeout(() => {
      entries.delete(branchId);
      echo.leave(channelName(branchId));
    }, 0);
  };
}
