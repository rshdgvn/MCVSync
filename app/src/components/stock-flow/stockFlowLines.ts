import type { Item } from "@/types/inventory";

export interface StockFlowLine {
  id: number;
  item: Item;
  target: number;
  done: number;
  queued?: number;
}

export type StockFlowScan = { barcode: string } | { item_id: number };

export type LocalMatch = { status: "found"; line: StockFlowLine; remaining: number } | { status: "not_found"; barcode: string | null };

export type StockFlowLineState = "pending" | "partial" | "complete" | "over";

export function lineState(line: StockFlowLine): StockFlowLineState {
  if (line.done === 0) {
    return "pending";
  }
  if (line.done < line.target) {
    return "partial";
  }
  return line.done === line.target ? "complete" : "over";
}

export function remainingQuantity(line: StockFlowLine): number {
  return Math.max(0, line.target - line.done - (line.queued ?? 0));
}

export function hasProgress(line: StockFlowLine): boolean {
  return line.done > 0 || (line.queued ?? 0) > 0;
}

export function withQueuedQuantities(lines: StockFlowLine[], queued: Map<number, number>): StockFlowLine[] {
  if (queued.size === 0) {
    return lines;
  }
  return lines.map((line) => {
    const quantity = queued.get(line.id);
    return quantity ? { ...line, queued: quantity } : line;
  });
}

export function matchScanLocally(lines: StockFlowLine[], scan: StockFlowScan): LocalMatch {
  const line =
    "barcode" in scan
      ? lines.find((candidate) => candidate.item.barcode !== null && candidate.item.barcode === scan.barcode)
      : lines.find((candidate) => candidate.item.id === scan.item_id);
  if (line) {
    return { status: "found", line, remaining: remainingQuantity(line) };
  }
  return { status: "not_found", barcode: "barcode" in scan ? scan.barcode : null };
}

export interface StockFlowSummary {
  total: number;
  finished: number;
  matched: number;
  short: number;
  over: number;
}

export function summarizeLines(lines: StockFlowLine[]): StockFlowSummary {
  const states = lines.map(lineState);
  const count = (state: StockFlowLineState) => states.filter((candidate) => candidate === state).length;
  return {
    total: lines.length,
    finished: count("complete") + count("over"),
    matched: count("complete"),
    short: count("partial"),
    over: count("over"),
  };
}

export function shortLines(lines: StockFlowLine[]): StockFlowLine[] {
  return lines.filter((line) => line.done < line.target);
}

export function overLines(lines: StockFlowLine[]): StockFlowLine[] {
  return lines.filter((line) => line.done > line.target);
}
