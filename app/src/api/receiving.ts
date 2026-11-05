import { api } from "@/api/client";
import { canReceivePurchaseOrder } from "@/components/purchase-orders/purchaseOrderRules";
import type { Discrepancy } from "@/types/discrepancy";
import type { Item } from "@/types/inventory";
import type { PurchaseOrderDetail, PurchaseOrderLine, PurchaseOrderSummary } from "@/types/purchaseOrder";
import type { Branch } from "@/types/user";

export type ReceivingReferenceType = "purchase_order";

export interface ReceivingLine {
  id: number;
  item: Item;
  expected: number;
  received: number;
}

export interface ReceivingDocument {
  id: number;
  number: string;
  status: string;
  counterparty: string;
  branch: Branch;
  isReceivable: boolean;
}

export interface ReceivingSession {
  document: ReceivingDocument;
  lines: ReceivingLine[];
  discrepancies: Discrepancy[];
}

export type ReceivingMatch =
  | { status: "found"; line: ReceivingLine; remaining: number }
  | { status: "not_found"; item: Item };

export interface ReceiveLinePayload {
  lineId: number;
  quantity: number;
  batchNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
}

export interface NotOnDocumentPayload {
  itemId: number;
  scannedQuantity: number;
  notes: string | null;
}

export interface ReceivingCompletion {
  isClosed: boolean;
  lines: ReceivingLine[];
}

interface PurchaseOrderSessionResponse {
  purchase_order: Omit<PurchaseOrderSummary, "items_count" | "total">;
  lines: PurchaseOrderLine[];
  discrepancies: Discrepancy[];
}

type PurchaseOrderMatchResponse =
  | { status: "found"; purchase_order_item: PurchaseOrderLine; remaining_quantity: number }
  | { status: "not_found"; item: Item };

function purchaseOrderLine(line: PurchaseOrderLine): ReceivingLine {
  return { id: line.id, item: line.item, expected: line.quantity_ordered, received: line.quantity_received };
}

function receivePath(referenceType: ReceivingReferenceType, id: number): string {
  const paths: Record<ReceivingReferenceType, string> = {
    purchase_order: `/staff/purchase-orders/${id}/receive`,
  };
  return paths[referenceType];
}

const LINE_FIELD: Record<ReceivingReferenceType, string> = {
  purchase_order: "purchase_order_item_id",
};

export async function getReceivingSession(referenceType: ReceivingReferenceType, id: number): Promise<ReceivingSession> {
  const response = await api.get<PurchaseOrderSessionResponse>(receivePath(referenceType, id));
  const { purchase_order: purchaseOrder, lines, discrepancies } = response.data;
  return {
    document: {
      id: purchaseOrder.id,
      number: purchaseOrder.po_number,
      status: purchaseOrder.status,
      counterparty: purchaseOrder.supplier.name,
      branch: purchaseOrder.branch,
      isReceivable: canReceivePurchaseOrder(purchaseOrder.status),
    },
    lines: lines.map(purchaseOrderLine),
    discrepancies,
  };
}

export async function matchReceivingScan(
  referenceType: ReceivingReferenceType,
  id: number,
  scan: { barcode: string } | { item_id: number },
): Promise<ReceivingMatch> {
  const response = await api.post<PurchaseOrderMatchResponse>(`${receivePath(referenceType, id)}/match`, scan);
  const result = response.data;
  return result.status === "found"
    ? { status: "found", line: purchaseOrderLine(result.purchase_order_item), remaining: result.remaining_quantity }
    : { status: "not_found", item: result.item };
}

export async function receiveLine(
  referenceType: ReceivingReferenceType,
  id: number,
  payload: ReceiveLinePayload,
): Promise<ReceivingLine> {
  const response = await api.post<PurchaseOrderLine>(`${receivePath(referenceType, id)}/confirm`, {
    [LINE_FIELD[referenceType]]: payload.lineId,
    quantity_received: payload.quantity,
    batch_number: payload.batchNumber,
    mfg_date: payload.mfgDate,
    expiry_date: payload.expiryDate,
  });
  return purchaseOrderLine(response.data);
}

export async function logNotOnDocument(
  referenceType: ReceivingReferenceType,
  id: number,
  payload: NotOnDocumentPayload,
): Promise<Discrepancy> {
  const response = await api.post<Discrepancy>(`${receivePath(referenceType, id)}/discrepancy`, {
    type: "not_found",
    item_id: payload.itemId,
    scanned_quantity: payload.scannedQuantity,
    notes: payload.notes,
  });
  return response.data;
}

export async function completeReceiving(referenceType: ReceivingReferenceType, id: number): Promise<ReceivingCompletion> {
  const response = await api.post<PurchaseOrderDetail>(`${receivePath(referenceType, id)}/complete`);
  return { isClosed: response.data.status === "closed", lines: response.data.items.map(purchaseOrderLine) };
}
