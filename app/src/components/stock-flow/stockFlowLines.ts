import type { Item } from "@/types/inventory";

export interface StockFlowLine {
  id: number;
  item: Item;
  target: number;
  done: number;
}

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
  return Math.max(0, line.target - line.done);
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
