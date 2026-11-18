import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lineState,
  matchScanLocally,
  overLines,
  remainingQuantity,
  shortLines,
  summarizeLines,
  withQueuedQuantities,
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

describe("offline stock flow lines", () => {
  const lines: StockFlowLine[] = [
    { id: 1, item: { id: 10, barcode: "4800001" } as Item, target: 10, done: 4 },
    { id: 2, item: { id: 20, barcode: null } as Item, target: 5, done: 0 },
  ];

  it("counts queued quantities against what is still remaining", () => {
    const queued = withQueuedQuantities(lines, new Map([[1, 3]]));
    assert.equal(queued[0].queued, 3);
    assert.equal(remainingQuantity(queued[0]), 3);
    assert.equal(queued[1], lines[1]);
  });

  it("matches a barcode or a chosen item against the saved lines", () => {
    const byBarcode = matchScanLocally(lines, { barcode: "4800001" });
    assert.equal(byBarcode.status === "found" && byBarcode.line.id, 1);
    assert.equal(byBarcode.status === "found" && byBarcode.remaining, 6);

    const byItem = matchScanLocally(lines, { item_id: 20 });
    assert.equal(byItem.status === "found" && byItem.line.id, 2);
  });

  it("reports an unknown barcode as not on the document", () => {
    assert.deepEqual(matchScanLocally(lines, { barcode: "999" }), { status: "not_found", barcode: "999" });
  });
});
