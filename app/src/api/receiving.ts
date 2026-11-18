import { api } from "@/api/client";
import { getTransfer, transferStatusKey } from "@/api/transfers";
import { canReceivePurchaseOrder } from "@/components/purchase-orders/purchaseOrderRules";
import { db } from "@/db/schema";
import { withOfflineCache } from "@/lib/offline/offlineCache";
import { sendOrQueue, type SendOutcome } from "@/lib/offline/sendOrQueue";
import type { StockFlowLine } from "@/components/stock-flow/stockFlowLines";
import type { Discrepancy } from "@/types/discrepancy";
import type { Item } from "@/types/inventory";
import type { PurchaseOrderDetail, PurchaseOrderLine, PurchaseOrderSummary } from "@/types/purchaseOrder";
import type { TransferDetail, TransferLine } from "@/types/transfer";
import type { Branch } from "@/types/user";

export type ReceivingReferenceType = "purchase_order" | "transfer_request";

export interface ReceivingDocument {
  id: number;
  number: string;
  statusKey: string;
  counterparty: string;
  branch: Branch;
  isReceivable: boolean;
}

export interface ReceivingSession {
  document: ReceivingDocument;
  lines: StockFlowLine[];
  discrepancies: Discrepancy[];
}

export type ReceivingMatch =
  | { status: "found"; line: StockFlowLine; remaining: number }
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
  lines: StockFlowLine[];
}

interface PurchaseOrderSessionResponse {
  purchase_order: Omit<PurchaseOrderSummary, "items_count" | "total">;
  lines: PurchaseOrderLine[];
  discrepancies: Discrepancy[];
}

type MatchResponse =
  | { status: "found"; purchase_order_item?: PurchaseOrderLine; transfer_request_item?: TransferLine; remaining_quantity: number }
  | { status: "not_found"; item: Item };

function purchaseOrderLine(line: PurchaseOrderLine): StockFlowLine {
  return { id: line.id, item: line.item, target: line.quantity_ordered, done: line.quantity_received };
}

function transferLine(line: TransferLine): StockFlowLine {
  return { id: line.id, item: line.item, target: line.quantity_picked, done: line.quantity_received };
}

function transferDocument(transfer: TransferDetail): ReceivingDocument {
  return {
    id: transfer.id,
    number: transfer.transfer_number,
    statusKey: transferStatusKey(transfer.status),
    counterparty: transfer.fulfilling_branch.name,
    branch: transfer.requesting_branch,
    isReceivable: transfer.status === "shipped",
  };
}

const SOURCES = {
  purchase_order: {
    path: (id: number) => `/staff/purchase-orders/${id}/receive`,
    lineField: "purchase_order_item_id",
    toLine: (line: PurchaseOrderLine | TransferLine) => purchaseOrderLine(line as PurchaseOrderLine),
    matchedLine: (result: Extract<MatchResponse, { status: "found" }>) => result.purchase_order_item,
  },
  transfer_request: {
    path: (id: number) => `/staff/transfers/${id}/receive`,
    lineField: "transfer_request_item_id",
    toLine: (line: PurchaseOrderLine | TransferLine) => transferLine(line as TransferLine),
    matchedLine: (result: Extract<MatchResponse, { status: "found" }>) => result.transfer_request_item,
  },
} as const;

async function purchaseOrderSession(id: number): Promise<ReceivingSession> {
  const response = await api.get<PurchaseOrderSessionResponse>(SOURCES.purchase_order.path(id));
  const { purchase_order: purchaseOrder, lines, discrepancies } = response.data;
  return {
    document: {
      id: purchaseOrder.id,
      number: purchaseOrder.po_number,
      statusKey: purchaseOrder.status,
      counterparty: purchaseOrder.supplier.name,
      branch: purchaseOrder.branch,
      isReceivable: canReceivePurchaseOrder(purchaseOrder.status),
    },
    lines: lines.map(purchaseOrderLine),
    discrepancies,
  };
}

async function transferSession(id: number): Promise<ReceivingSession> {
  const [transfer, discrepancies] = await Promise.all([
    getTransfer(id),
    api.get<Discrepancy[]>(`/staff/transfers/${id}/discrepancies`).then((response) => response.data),
  ]);
  return { document: transferDocument(transfer), lines: transfer.items.map(transferLine), discrepancies };
}

export function receivingScope(referenceType: ReceivingReferenceType, id: number): string {
  return `receive:${referenceType}:${id}`;
}

export function receivingCacheKey(referenceType: ReceivingReferenceType, id: number): string {
  return `receiving:${referenceType}:${id}`;
}

export function getReceivingSession(referenceType: ReceivingReferenceType, id: number): Promise<ReceivingSession> {
  return withOfflineCache(db.cached_orders, receivingCacheKey(referenceType, id), () =>
    referenceType === "purchase_order" ? purchaseOrderSession(id) : transferSession(id),
  );
}

export async function matchReceivingScan(
  referenceType: ReceivingReferenceType,
  id: number,
  scan: { barcode: string } | { item_id: number },
): Promise<ReceivingMatch> {
  const source = SOURCES[referenceType];
  const response = await api.post<MatchResponse>(`${source.path(id)}/match`, scan);
  const result = response.data;
  if (result.status === "not_found") {
    return { status: "not_found", item: result.item };
  }
  const line = source.matchedLine(result);
  if (!line) {
    throw new Error("The match response did not include the matched line.");
  }
  return { status: "found", line: source.toLine(line), remaining: result.remaining_quantity };
}

export async function receiveLine(
  userId: number,
  referenceType: ReceivingReferenceType,
  id: number,
  payload: ReceiveLinePayload,
  label: string,
): Promise<SendOutcome<StockFlowLine>> {
  const source = SOURCES[referenceType];
  const outcome = await sendOrQueue<PurchaseOrderLine | TransferLine>(
    userId,
    {
      method: "POST",
      url: `${source.path(id)}/confirm`,
      payload: {
        [source.lineField]: payload.lineId,
        quantity_received: payload.quantity,
        batch_number: payload.batchNumber,
        mfg_date: payload.mfgDate,
        expiry_date: payload.expiryDate,
      },
    },
    { scope: receivingScope(referenceType, id), line_id: payload.lineId, quantity: payload.quantity, label },
  );
  return outcome.queued ? outcome : { queued: false, data: source.toLine(outcome.data) };
}

export function logNotOnDocument(
  userId: number,
  referenceType: ReceivingReferenceType,
  id: number,
  payload: NotOnDocumentPayload,
  label: string,
): Promise<SendOutcome<Discrepancy>> {
  return sendOrQueue<Discrepancy>(
    userId,
    {
      method: "POST",
      url: `${SOURCES[referenceType].path(id)}/discrepancy`,
      payload: {
        type: "not_found",
        item_id: payload.itemId,
        scanned_quantity: payload.scannedQuantity,
        notes: payload.notes,
      },
    },
    { scope: receivingScope(referenceType, id), line_id: null, quantity: payload.scannedQuantity, label },
  );
}

export async function completeReceiving(referenceType: ReceivingReferenceType, id: number): Promise<ReceivingCompletion> {
  const response = await api.post<PurchaseOrderDetail | TransferDetail>(`${SOURCES[referenceType].path(id)}/complete`);
  const items: (PurchaseOrderLine | TransferLine)[] = response.data.items;
  return { isClosed: response.data.status === "closed", lines: items.map(SOURCES[referenceType].toLine) };
}
