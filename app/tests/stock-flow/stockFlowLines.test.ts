import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lineState,
  overLines,
  remainingQuantity,
  shortLines,
  summarizeLines,
  type StockFlowLine,
} from "@/components/stock-flow/stockFlowLines";
import type { Item } from "@/types/inventory";

function line(id: number, target: number, done: number): StockFlowLine {
  return { id, item: { id } as Item, target, done };
}

describe("stock flow line state", () => {
  it("classifies each line by how much is done", () => {
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
    assert.deepEqual(summarizeLines(lines), { total: 4, finished: 2, matched: 1, short: 1, over: 1 });
  });

  it("treats untouched lines as short when completing", () => {
    const lines = [line(1, 10, 0), line(2, 10, 4), line(3, 10, 10), line(4, 10, 12)];
    assert.deepEqual(shortLines(lines).map(({ id }) => id), [1, 2]);
    assert.deepEqual(overLines(lines).map(({ id }) => id), [4]);
  });
});
