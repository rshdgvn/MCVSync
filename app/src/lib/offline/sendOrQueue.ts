import { db } from "@/db/schema";
import { enqueueMutation, type QueuedChange, type QueuedRequest } from "@/db/pendingMutations";
import { isNetworkError } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/offline/idempotencyKey";
import { replayPendingMutations, sendQueuedMutation } from "@/lib/offline/replay";

export type SendOutcome<T> = { queued: false; data: T } | { queued: true };

export type QueueableChange = Omit<QueuedChange, "user_id">;

export type OutgoingRequest = Omit<QueuedRequest, "idempotency_key">;

async function hasUnsyncedBacklog(userId: number): Promise<boolean> {
  const unsynced = await db.pending_mutations
    .where("user_id")
    .equals(userId)
    .filter((mutation) => mutation.status !== "failed")
    .count();
  return unsynced > 0;
}

async function queue(userId: number, request: QueuedRequest, change: QueueableChange): Promise<SendOutcome<never>> {
  await enqueueMutation(request, { ...change, user_id: userId });
  if (navigator.onLine) {
    void replayPendingMutations(userId);
  }
  return { queued: true };
}

export async function sendOrQueue<T>(
  userId: number,
  outgoing: OutgoingRequest,
  change: QueueableChange,
): Promise<SendOutcome<T>> {
  const request: QueuedRequest = { ...outgoing, idempotency_key: newIdempotencyKey() };
  if (!navigator.onLine || (await hasUnsyncedBacklog(userId))) {
    return queue(userId, request, change);
  }
  try {
    const response = await sendQueuedMutation<T>(request);
    return { queued: false, data: response.data };
  } catch (error) {
    if (isNetworkError(error)) {
      return queue(userId, request, change);
    }
    throw error;
  }
}

export function requireUserId(userId: number | undefined): number {
  if (userId === undefined) {
    throw new Error("Your session isn't loaded yet. Reload the page and try again.");
  }
  return userId;
}
