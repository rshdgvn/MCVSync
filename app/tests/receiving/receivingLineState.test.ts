import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReceivingLine } from "@/api/receiving";
import {
  lineState,
  overLines,
  remainingQuantity,
  shortLines,
  summarizeLines,
} from "@/components/receiving/receivingLineState";
import type { Item } from "@/types/inventory";

function line(id: number, expected: number, received: number): ReceivingLine {
  return { id, item: { id } as Item, expected, received };
}

describe("receiving line state", () => {
  it("classifies each line by what has been received", () => {
    assert.equal(lineState(line(1, 10, 0)), "pending");
    assert.equal(lineState(line(2, 10, 4)), "partial");
    assert.equal(lineState(line(3, 10, 10)), "complete");
    assert.equal(lineState(line(4, 10, 12)), "over");
  });

  it("never reports a negative remaining quantity", () => {
    assert.equal(remainingQuantity(line(1, 10, 4)), 6);
    assert.equal(remainingQuantity(line(2, 10, 12)), 0);
  });

  it("summarizes a session for the header counts", () => {
    const lines = [line(1, 10, 0), line(2, 10, 4), line(3, 10, 10), line(4, 10, 12)];
    assert.deepEqual(summarizeLines(lines), { total: 4, fullyReceived: 2, matched: 1, short: 1, over: 1 });
  });

  it("treats untouched lines as short when completing", () => {
    const lines = [line(1, 10, 0), line(2, 10, 4), line(3, 10, 10), line(4, 10, 12)];
    assert.deepEqual(shortLines(lines).map(({ id }) => id), [1, 2]);
    assert.deepEqual(overLines(lines).map(({ id }) => id), [4]);
  });
});
