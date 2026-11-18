import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PendingMutation } from "@/db/schema";
import { replayQueue, type ReplayQueue } from "@/lib/offline/replayQueue";

const CONNECTION_LOST = "connection lost";

function mutation(id: number, createdAt: number): PendingMutation {
  return {
    id,
    method: "POST",
    url: `/staff/transfers/1/fulfill/pick?n=${id}`,
    payload: { id },
    created_at: createdAt,
    status: "pending",
    user_id: 1,
    scope: "pick:transfer_request:1",
    line_id: 1,
    quantity: 1,
    label: `Pick ${id}`,
  };
}

function memoryQueue(rows: PendingMutation[]) {
  const store = new Map(rows.map((row) => [row.id, { ...row }]));
  const queue: ReplayQueue = {
    list: async () => [...store.values()].filter((row) => row.status === "pending"),
    claim: async (id) => {
      const row = store.get(id);
      if (row?.status !== "pending") {
        return false;
      }
      row.status = "syncing";
      return true;
    },
    remove: async (id) => {
      store.delete(id);
    },
    fail: async (id, reason) => {
      const row = store.get(id);
      if (row) {
        row.status = "failed";
        row.error_reason = reason;
      }
    },
  };
  return { queue, store };
}

const rejection = new Error("rejected");
const networkDown = new Error("network");

function handlers(send: (mutation: PendingMutation) => Promise<unknown>) {
  return {
    send,
    isConnectionLost: (error: unknown) => error === networkDown,
    describeRejection: () => "Batch B-1 only has 2 left.",
    connectionLostReason: CONNECTION_LOST,
  };
}

describe("offline replay queue", () => {
  it("replays oldest first, one at a time, and deletes each synced row", async () => {
    const { queue, store } = memoryQueue([mutation(3, 300), mutation(1, 100), mutation(2, 200)]);
    const sent: number[] = [];
    let inFlight = 0;

    const result = await replayQueue(
      queue,
      handlers(async (row) => {
        inFlight += 1;
        assert.equal(inFlight, 1);
        await Promise.resolve();
        sent.push(row.id);
        inFlight -= 1;
      }),
    );

    assert.deepEqual(sent, [1, 2, 3]);
    assert.equal(result.synced.length, 3);
    assert.equal(store.size, 0);
  });

  it("marks a server rejection failed with its reason and keeps replaying the rest", async () => {
    const { queue, store } = memoryQueue([mutation(1, 100), mutation(2, 200), mutation(3, 300)]);

    const result = await replayQueue(
      queue,
      handlers(async (row) => {
        if (row.id === 2) {
          throw rejection;
        }
      }),
    );

    assert.deepEqual(result.synced.map((row) => row.id), [1, 3]);
    assert.deepEqual([...store.keys()], [2]);
    assert.equal(store.get(2)?.status, "failed");
    assert.equal(store.get(2)?.error_reason, "Batch B-1 only has 2 left.");
  });

  it("stops at a dropped connection and flags that row for a human instead of resending it", async () => {
    const { queue, store } = memoryQueue([mutation(1, 100), mutation(2, 200), mutation(3, 300)]);

    const result = await replayQueue(
      queue,
      handlers(async (row) => {
        if (row.id === 2) {
          throw networkDown;
        }
      }),
    );

    assert.equal(result.connectionLost, true);
    assert.equal(store.get(2)?.status, "failed");
    assert.equal(store.get(2)?.error_reason, CONNECTION_LOST);
    assert.equal(store.get(3)?.status, "pending");
  });

  it("skips rows another tab already claimed", async () => {
    const { queue, store } = memoryQueue([mutation(1, 100), mutation(2, 200)]);
    await queue.claim(1);
    const sent: number[] = [];

    await replayQueue(
      { ...queue, list: async () => [...store.values()] },
      handlers(async (row) => {
        sent.push(row.id);
      }),
    );

    assert.deepEqual(sent, [2]);
  });
});
