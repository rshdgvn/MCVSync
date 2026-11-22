import type { CofDetail, CofLine, CofStatus, SalesItem } from "@/types/clientOrderForm";
import type { User } from "@/types/user";

export const COF_PERMISSIONS = {
  create: "cof.create",
  forward: "cof.forward_to_purchasing",
  confirmCancellation: "cof.confirm_cancellation",
} as const;

export const MESSAGE_AGING_WARN_DAYS = 1;
export const MESSAGE_AGING_DANGER_DAYS = 2;

const INSTANT_CANCEL: ReadonlySet<CofStatus> = new Set(["pending_approval", "needs_revision"]);
const BILLED: ReadonlySet<CofStatus> = new Set(["processing", "ready_for_delivery", "delivered", "completed"]);

export interface DraftLineItem {
  id: number;
  name: string;
  sku: string;
  unitCode: string | null;
}

export interface DraftCofLine {
  key: string;
  item: DraftLineItem;
  quantity: number;
  discountPercent: number;
  reason: string;
  requested: number | null;
  unitCost: number | null;
}

export function hasPermission(user: User | undefined, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function isEditableCof(status: CofStatus): boolean {
  return status === "pending_approval";
}

export function canCancelInstantly(status: CofStatus): boolean {
  return INSTANT_CANCEL.has(status);
}

export function isBilled(status: CofStatus): boolean {
  return BILLED.has(status);
}

export function draftItemFromSales(item: SalesItem): DraftLineItem {
  return { id: item.id, name: item.name, sku: item.sku, unitCode: item.unit?.code ?? null };
}

export function draftLinesFromCof(cof: CofDetail): DraftCofLine[] {
  const requested = new Map((cof.source?.items ?? []).map((line) => [line.item.id, line.quantity]));
  const portal = cof.source_type === "portal";

  return cof.items.map((line: CofLine) => ({
    key: `line-${line.id}`,
    item: { id: line.item.id, name: line.item.name, sku: line.item.sku, unitCode: line.item.unit?.code ?? null },
    quantity: line.quantity,
    discountPercent: line.discount_percent,
    reason: line.differs_from_request_reason ?? "",
    requested: portal ? (requested.get(line.item.id) ?? 0) : null,
    unitCost: line.unit_cost ?? line.suggested_unit_cost ?? null,
  }));
}

export function lineDiffers(line: DraftCofLine): boolean {
  return line.requested !== null && line.requested !== line.quantity;
}

export function estimatedLineTotal(line: DraftCofLine): number | null {
  return line.unitCost === null ? null : line.quantity * line.unitCost * (1 - line.discountPercent / 100);
}

export function missingReasons(lines: DraftCofLine[]): DraftCofLine[] {
  return lines.filter((line) => lineDiffers(line) && line.reason.trim() === "");
}

export function linesPayload(lines: DraftCofLine[]) {
  return lines.map((line) => ({
    item_id: line.item.id,
    quantity: line.quantity,
    discount_percent: line.discountPercent,
    differs_from_request_reason: lineDiffers(line) ? line.reason.trim() : null,
  }));
}
