import type { PendingMutation } from "@/db/schema";

export interface ReplayQueue {
  list: () => Promise<PendingMutation[]>;
  claim: (id: number) => Promise<boolean>;
  remove: (id: number) => Promise<void>;
  fail: (id: number, reason: string) => Promise<void>;
  release: (id: number) => Promise<void>;
}

export interface ReplayHandlers {
  send: (mutation: PendingMutation) => Promise<unknown>;
  isConnectionLost: (error: unknown) => boolean;
  describeRejection: (error: unknown) => string;
}

export interface ReplayResult {
  synced: PendingMutation[];
  failed: PendingMutation[];
  connectionLost: boolean;
}

export async function replayQueue(queue: ReplayQueue, handlers: ReplayHandlers): Promise<ReplayResult> {
  const result: ReplayResult = { synced: [], failed: [], connectionLost: false };
  const oldestFirst = [...(await queue.list())].sort((first, second) => first.created_at - second.created_at);

  for (const mutation of oldestFirst) {
    if (!(await queue.claim(mutation.id))) {
      continue;
    }
    try {
      await handlers.send(mutation);
      await queue.remove(mutation.id);
      result.synced.push(mutation);
    } catch (error) {
      if (handlers.isConnectionLost(error)) {
        await queue.release(mutation.id);
        result.connectionLost = true;
        break;
      }
      await queue.fail(mutation.id, handlers.describeRejection(error));
      result.failed.push(mutation);
    }
  }

  return result;
}
