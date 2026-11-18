import { db } from "@/db/schema";
import { enqueueMutation, type QueuedChange, type QueuedRequest } from "@/db/pendingMutations";
import { replayPendingMutations, sendQueuedMutation } from "@/lib/offline/replay";

export type SendOutcome<T> = { queued: false; data: T } | { queued: true };

export type QueueableChange = Omit<QueuedChange, "user_id">;

async function hasUnsyncedBacklog(userId: number): Promise<boolean> {
  const unsynced = await db.pending_mutations
    .where("user_id")
    .equals(userId)
    .filter((mutation) => mutation.status !== "failed")
    .count();
  return unsynced > 0;
}

export async function sendOrQueue<T>(
  userId: number,
  request: QueuedRequest,
  change: QueueableChange,
): Promise<SendOutcome<T>> {
  if (!navigator.onLine || (await hasUnsyncedBacklog(userId))) {
    await enqueueMutation(request, { ...change, user_id: userId });
    if (navigator.onLine) {
      void replayPendingMutations(userId);
    }
    return { queued: true };
  }
  const response = await sendQueuedMutation<T>(request);
  return { queued: false, data: response.data };
}

export function requireUserId(userId: number | undefined): number {
  if (userId === undefined) {
    throw new Error("Your session isn't loaded yet. Reload the page and try again.");
  }
  return userId;
}
