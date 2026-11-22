import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliveryReceiptDocument } from "@/api/clientOrderForms";
import {
  draftLinesFromCof,
  estimatedLineTotal,
  lineDiffers,
  linesPayload,
  missingReasons,
  type DraftCofLine,
} from "@/components/sales/cofRules";
import { findActiveKeys, NAVIGATION } from "@/config/navigation";
import type { CofDetail } from "@/types/clientOrderForm";
import type { Item } from "@/types/inventory";

function item(id: number, name: string): Item {
  return { id, name, sku: `SKU-${id}`, unit: { id: 1, code: "box", name: "Box" } } as Item;
}

function draft(overrides: Partial<DraftCofLine>): DraftCofLine {
  return {
    key: "line",
    item: { id: 1, name: "Gloves", sku: "GLV", unitCode: "box" },
    quantity: 10,
    discountPercent: 0,
    reason: "",
    requested: 10,
    unitCost: 100,
    ...overrides,
  };
}

const portalCof = {
  source_type: "portal",
  source: { id: 1, notes: null, submitted_at: null, items: [{ item: item(1, "Gloves"), quantity: 10 }] },
  items: [
    {
      id: 7,
      item: item(1, "Gloves"),
      quantity: 8,
      quantity_picked: 0,
      unit_cost: null,
      suggested_unit_cost: 120,
      discount_percent: 5,
      total: null,
      differs_from_request: true,
      differs_from_request_reason: "Only 8 left",
    },
    {
      id: 8,
      item: item(2, "Masks"),
      quantity: 3,
      quantity_picked: 0,
      unit_cost: null,
      suggested_unit_cost: null,
      discount_percent: 0,
      total: null,
      differs_from_request: true,
      differs_from_request_reason: null,
    },
  ],
} as unknown as CofDetail;

describe("COF review rules", () => {
  it("compares each portal line with what the client requested", () => {
    const lines = draftLinesFromCof(portalCof);

    assert.equal(lines[0].requested, 10);
    assert.equal(lines[0].unitCost, 120);
    assert.equal(lineDiffers(lines[0]), true);
    assert.equal(lines[1].requested, 0, "an added item counts as not requested");
    assert.equal(lines[1].unitCost, null, "an unpriced line stays Awaiting Accounting");
  });

  it("requires a reason only on lines that differ", () => {
    const lines = [draft({ key: "same" }), draft({ key: "changed", quantity: 8 }), draft({ key: "explained", quantity: 6, reason: "Short" })];

    assert.deepEqual(
      missingReasons(lines).map((line) => line.key),
      ["changed"],
    );
  });

  it("never asks for a reason on manual lines", () => {
    assert.equal(lineDiffers(draft({ requested: null, quantity: 3 })), false);
  });

  it("sends the reason only for differing lines", () => {
    assert.deepEqual(linesPayload([draft({ reason: "ignored" }), draft({ quantity: 7, reason: "  Short  ", discountPercent: 2.5 })]), [
      { item_id: 1, quantity: 10, discount_percent: 0, differs_from_request_reason: null },
      { item_id: 1, quantity: 7, discount_percent: 2.5, differs_from_request_reason: "Short" },
    ]);
  });

  it("estimates a line total only when Accounting has priced it", () => {
    assert.equal(estimatedLineTotal(draft({ quantity: 4, unitCost: 50, discountPercent: 10 })), 180);
    assert.equal(estimatedLineTotal(draft({ unitCost: null })), null);
  });
});

describe("delivery receipt availability", () => {
  it("is offered only once the order has a DR number and is ready or later", () => {
    assert.deepEqual(deliveryReceiptDocument({ id: 4, dr_number: "DR-0002", order_status: "delivered" }), {
      path: "/staff/client-order-forms/4/delivery-receipt.pdf",
      filename: "DR-0002.pdf",
    });
    assert.equal(deliveryReceiptDocument({ id: 4, dr_number: null, order_status: "processing" }), null);
    assert.equal(deliveryReceiptDocument({ id: 4, dr_number: "DR-0002", order_status: "cancelled" }), null);
  });
});

describe("sales navigation", () => {
  it("keeps the Client Order Forms entry active on new and detail pages", () => {
    const sales = NAVIGATION.sales;
    assert.deepEqual(findActiveKeys(sales, "/sales/cofs/new"), { parentKey: "orders", childKey: "cofs" });
    assert.deepEqual(findActiveKeys(sales, "/sales/cofs/12"), { parentKey: "orders", childKey: "cofs" });
  });
});
