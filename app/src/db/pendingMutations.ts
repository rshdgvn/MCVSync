import { db } from "@/db/schema";
import type { PendingMutation } from "@/db/schema";

export type QueuedRequest = Pick<PendingMutation, "method" | "url" | "payload" | "idempotency_key">;

export type QueuedChange = Pick<PendingMutation, "user_id" | "scope" | "line_id" | "quantity" | "label">;

export async function enqueueMutation(request: QueuedRequest, change: QueuedChange): Promise<number> {
  return db.pending_mutations.add({
    ...request,
    ...change,
    created_at: Date.now(),
    status: "pending",
  });
}

export async function listReplayableMutations(userId: number): Promise<PendingMutation[]> {
  const rows = await db.pending_mutations.where("user_id").equals(userId).sortBy("created_at");
  return rows.filter((mutation) => mutation.status === "pending");
}

export async function claimMutation(id: number): Promise<boolean> {
  return db.transaction("rw", db.pending_mutations, async () => {
    const mutation = await db.pending_mutations.get(id);
    if (mutation?.status !== "pending") {
      return false;
    }
    await db.pending_mutations.update(id, { status: "syncing" });
    return true;
  });
}

export async function releaseInterruptedSyncs(userId: number): Promise<void> {
  await db.pending_mutations
    .where("user_id")
    .equals(userId)
    .filter((mutation) => mutation.status === "syncing")
    .modify({ status: "pending" });
}

export async function releaseMutation(id: number): Promise<void> {
  await db.pending_mutations.update(id, { status: "pending" });
}

export async function markFailed(id: number, errorReason: string): Promise<void> {
  await db.pending_mutations.update(id, {
    status: "failed",
    error_reason: errorReason,
  });
}

export async function removeMutation(id: number): Promise<void> {
  await db.pending_mutations.delete(id);
}

export async function retryMutation(
  mutation: PendingMutation,
  send: (mutation: PendingMutation) => Promise<unknown>,
  describeError: (error: unknown) => string,
): Promise<boolean> {
  await db.pending_mutations.update(mutation.id, { status: "syncing" });
  try {
    await send(mutation);
    await removeMutation(mutation.id);
    return true;
  } catch (error) {
    await markFailed(mutation.id, describeError(error));
    return false;
  }
}
