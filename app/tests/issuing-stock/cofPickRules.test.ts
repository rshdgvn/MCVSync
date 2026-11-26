import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cofPickScope } from "@/api/cofFulfillment";
import { pickScope } from "@/api/transfers";
import { canPickCof, waitingSince } from "@/components/issuing-stock/cofPickRules";
import { findActiveKeys, NAVIGATION } from "@/config/navigation";
import { daysSince } from "@/lib/format";
import type { Branch, User } from "@/types/user";

const apalit: Branch = { id: 1, name: "Apalit", code: "APALIT", address: "Apalit", is_main: true };
const cebu: Branch = { id: 2, name: "Cebu", code: "CEBU", address: "Cebu", is_main: false };

function staff(role: User["role"], branch: Branch | null): User {
  return { id: 1, role, branch, permissions: [] } as unknown as User;
}

function order(overrides: Partial<Parameters<typeof canPickCof>[1]> = {}): Parameters<typeof canPickCof>[1] {
  return { order_status: "processing", branch: apalit, cancellation_requested: false, picking_completed_at: null, ...overrides };
}

describe("client order picking", () => {
  it("lets only the order's branch pick while it is processing", () => {
    assert.equal(canPickCof(staff("purchasing", apalit), order()), true);
    assert.equal(canPickCof(staff("purchasing", cebu), order()), false);
    assert.equal(canPickCof(staff("purchasing", apalit), order({ order_status: "ready_for_delivery" })), false);
  });

  it("lets admins pick for any branch", () => {
    assert.equal(canPickCof(staff("admin", null), order({ branch: cebu })), true);
  });

  it("pauses picking while a cancellation is requested and once picking is complete", () => {
    assert.equal(canPickCof(staff("purchasing", apalit), order({ cancellation_requested: true })), false);
    assert.equal(canPickCof(staff("purchasing", apalit), order({ picking_completed_at: "2026-11-26T09:00:00+08:00" })), false);
  });

  it("measures waiting time from when Sales forwarded the order", () => {
    assert.equal(waitingSince({ forwarded_at: "2026-11-25T09:00:00+08:00", created_at: "2026-11-20T09:00:00+08:00" }), "2026-11-25T09:00:00+08:00");
  });

  it("queues client order picks separately from transfer picks", () => {
    assert.notEqual(cofPickScope(7), pickScope(7));
    assert.equal(cofPickScope(7), "pick:client_order_form:7");
  });
});

describe("waiting time", () => {
  it("counts whole days since a date and never goes negative", () => {
    const now = new Date(2026, 10, 26, 15, 0);
    assert.equal(daysSince(new Date(2026, 10, 23, 9, 0), now), 3);
    assert.equal(daysSince(new Date(2026, 10, 26, 8, 0), now), 0);
    assert.equal(daysSince(new Date(2026, 10, 28, 8, 0), now), 0);
  });
});

describe("purchasing navigation", () => {
  it("keeps Issuing Stock active on the client order pick screen", () => {
    assert.deepEqual(findActiveKeys(NAVIGATION.purchasing, "/purchasing/issuing-stock/client-orders/12"), { parentKey: "issuing-stock" });
  });
});
