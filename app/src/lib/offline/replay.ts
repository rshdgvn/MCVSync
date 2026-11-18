import { api } from "@/api/client";
import type { PendingMutation } from "@/db/schema";
import {
  INTERRUPTED_SYNC_REASON,
  claimMutation,
  failInterruptedSyncs,
  listReplayableMutations,
  markFailed,
  removeMutation,
} from "@/db/pendingMutations";
import { discrepancyKeys } from "@/hooks/useDiscrepancies";
import { receivingKeys } from "@/hooks/useReceiving";
import { transferKeys } from "@/hooks/useTransfers";
import { getErrorMessage, isNetworkError } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { replayQueue, type ReplayResult } from "@/lib/offline/replayQueue";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/stores/toast.store";

const REPLAY_LOCK = "mcvsync-offline-replay";

let running: Promise<ReplayResult | null> | null = null;

export function sendQueuedMutation<T = unknown>(mutation: Pick<PendingMutation, "method" | "url" | "payload">) {
  return api.request<T>({ method: mutation.method, url: mutation.url, data: mutation.payload });
}

function replayOnce(userId: number): Promise<ReplayResult> {
  return replayQueue(
    {
      list: () => listReplayableMutations(userId),
      claim: claimMutation,
      remove: removeMutation,
      fail: markFailed,
    },
    {
      send: sendQueuedMutation,
      isConnectionLost: isNetworkError,
      describeRejection: getErrorMessage,
      connectionLostReason: INTERRUPTED_SYNC_REASON,
    },
  );
}

async function replayAll(userId: number): Promise<ReplayResult> {
  await failInterruptedSyncs(userId);
  const total: ReplayResult = { synced: [], failed: [], connectionLost: false };
  for (;;) {
    const pass = await replayOnce(userId);
    total.synced.push(...pass.synced);
    total.failed.push(...pass.failed);
    total.connectionLost = pass.connectionLost;
    if (pass.connectionLost || pass.synced.length + pass.failed.length === 0) {
      return total;
    }
  }
}

function withReplayLock(task: () => Promise<ReplayResult>): Promise<ReplayResult | null> {
  if (!("locks" in navigator)) {
    return task();
  }
  return navigator.locks.request(REPLAY_LOCK, { ifAvailable: true }, (lock) => (lock ? task() : null));
}

async function refreshStockFlows(): Promise<void> {
  await Promise.all(
    [receivingKeys.all, transferKeys.all, discrepancyKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

function changeCount(count: number): string {
  return `${count} offline ${count === 1 ? "change" : "changes"}`;
}

function announce(result: ReplayResult): void {
  if (result.synced.length > 0) {
    toast.success(`${changeCount(result.synced.length)} synced.`);
  }
  if (result.failed.length > 0) {
    toast.error(`${changeCount(result.failed.length)} couldn't sync. Review them in Sync Issues.`);
    notify("sync-failed");
  } else if (result.synced.length > 0) {
    notify("sync-success");
  }
}

export function replayPendingMutations(userId: number): Promise<ReplayResult | null> {
  if (running) {
    return running;
  }
  running = withReplayLock(() => replayAll(userId))
    .then(async (result) => {
      if (result && result.synced.length + result.failed.length > 0) {
        await refreshStockFlows();
        announce(result);
      }
      return result;
    })
    .finally(() => {
      running = null;
    });
  return running;
}
