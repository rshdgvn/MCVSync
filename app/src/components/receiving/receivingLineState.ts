import type { ReceivingLine } from "@/api/receiving";

export type ReceivingLineState = "pending" | "partial" | "complete" | "over";

export function lineState(line: ReceivingLine): ReceivingLineState {
  if (line.received === 0) {
    return "pending";
  }
  if (line.received < line.expected) {
    return "partial";
  }
  return line.received === line.expected ? "complete" : "over";
}

export function remainingQuantity(line: ReceivingLine): number {
  return Math.max(0, line.expected - line.received);
}

export interface ReceivingSummary {
  total: number;
  fullyReceived: number;
  matched: number;
  short: number;
  over: number;
}

export function summarizeLines(lines: ReceivingLine[]): ReceivingSummary {
  const states = lines.map(lineState);
  const count = (state: ReceivingLineState) => states.filter((candidate) => candidate === state).length;
  return {
    total: lines.length,
    fullyReceived: count("complete") + count("over"),
    matched: count("complete"),
    short: count("partial"),
    over: count("over"),
  };
}

export function shortLines(lines: ReceivingLine[]): ReceivingLine[] {
  return lines.filter((line) => line.received < line.expected);
}

export function overLines(lines: ReceivingLine[]): ReceivingLine[] {
  return lines.filter((line) => line.received > line.expected);
}
