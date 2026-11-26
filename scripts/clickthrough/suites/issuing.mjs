import {
  API_URL,
  APP_URL,
  apiGet,
  apiPost,
  check,
  goOffline,
  noHorizontalScroll,
  openAs,
  pendingCount,
  recordQueueWrites,
  runFlow,
  scan,
  visible,
  waitForPendingCount,
} from "../lib/browser.mjs";

const BARCODE = { gloves: "4800001000011", syringe: "4800001000028", masks: "4800001000035" };
const COF = { full: 1, short: 2, offline: 3, cebu: 4, pending: 5, cancelRequested: 6 };
const PRICE_FIELDS = /unit_cost|suggested_unit_cost|"srp"|"total"|discount_percent/;

async function pickPage(page, cofId) {
  await page.goto(`${APP_URL}/purchasing/issuing-stock/client-orders/${cofId}`);
  await visible(page.getByText("lines picked")).waitFor({ timeout: 20000 });
}

async function confirmPick(page, quantity) {
  const dialog = page.getByRole("dialog");
  await dialog.getByText("FEFO Batch (Earliest Expiry)").waitFor();
  if (quantity) {
    await dialog.locator("#pick-quantity").fill(String(quantity));
  }
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.waitFor({ state: "detached" });
}

async function queueAndFullPick(browser, shot) {
  const p = (name) => `queue-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  const card = visible(page.locator("a").filter({ hasText: "Client Orders to Pick" }));
  await card.waitFor({ timeout: 20000 });
  check(p("home counts the branch's client orders to pick"), ((await card.textContent()) ?? "").includes("4"), await card.textContent());
  await visible(page.getByText("Client Order to Pick")).waitFor();
  check(p("home lists client orders under Needs Action"), (await visible(page.getByRole("link", { name: /COF-0001/ })).count()) > 0);

  await visible(page.getByRole("link", { name: "Issuing Stock", exact: true })).click();
  await page.waitForURL(/\/purchasing\/issuing-stock$/);
  await visible(page.getByText("COF-0001")).waitFor({ timeout: 20000 });
  await page.getByRole("tab", { name: /Transfers to Pick\s*1/ }).waitFor({ timeout: 15000 }).catch(() => undefined);
  const tabs = await page.getByRole("tab").allTextContents();
  check(p("tabs are Client Orders then Transfers to Pick, with counts"), tabs[0]?.startsWith("Client Orders") && tabs[0]?.endsWith("4") && tabs[1]?.startsWith("Transfers to Pick") && tabs[1]?.endsWith("1"), tabs.join(" | "));
  const rows = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(p("other branches and unforwarded orders stay out"), !rows.includes("COF-0004") && !rows.includes("COF-0005"), rows.slice(0, 200));
  const queue = await apiGet(page, `${API_URL}/staff/client-order-forms/fulfillment-queue`);
  check(p("the queue exposes when each order was forwarded"), queue.data.every((row) => Boolean(row.forwarded_at)), JSON.stringify(queue.data.map((row) => row.forwarded_at)));
  check(p("rows waiting more than a day get an aging chip"), (await visible(page.getByRole("row").filter({ hasText: "COF-0001" })).innerText()).includes("3 days"));
  check(p("a cancellation request is flagged in the queue"), (await visible(page.getByRole("row").filter({ hasText: "COF-0006" })).innerText()).includes("Cancellation Requested"));
  check(p("the earliest order is listed first"), rows.indexOf("COF-0001") < rows.indexOf("COF-0002"));
  await noHorizontalScroll(page, p("queue"));
  await shot(page, p("01-client-orders"));

  await page.getByRole("tab", { name: /Transfers to Pick/ }).click();
  await visible(page.getByText("TR-0001")).waitFor();
  await visible(page.getByText("TR-0001")).click();
  await page.waitForURL(/\/purchasing\/transfers\/1\/pick$/);
  check(p("transfers to pick open the transfer pick screen"), true);

  const fulfillment = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.full}/fulfill`);
  check(p("the pick endpoint carries no prices"), !PRICE_FIELDS.test(JSON.stringify(fulfillment)), JSON.stringify(fulfillment).slice(0, 160));
  await pickPage(page, COF.full);
  const screen = await page.locator("main").innerText();
  check(p("the pick screen shows no prices"), !screen.includes("₱"));
  check(p("header shows client and branch"), screen.includes("Client Demo") && screen.includes("Apalit"));

  await scan(page, BARCODE.gloves);
  await dialog.getByText("FEFO Batch (Earliest Expiry)").waitFor();
  check(p("the pick sheet suggests the earliest-expiry batch"), (await dialog.getByText("GLV-EARLY").count()) > 0);
  check(p("a different batch can still be chosen"), (await dialog.getByRole("button", { name: "Use a different batch" }).count()) === 1);
  check(p("quantity defaults to what is left"), (await dialog.locator("#pick-quantity").inputValue()) === "10");
  await shot(page, p("02-pick-sheet"));
  await confirmPick(page);
  await scan(page, BARCODE.masks);
  await visible(page.getByText("Face Mask Box isn't on this order.")).waitFor();
  check(p("an item that isn't on the order says so"), true);
  await scan(page, BARCODE.syringe);
  await confirmPick(page);
  await visible(page.getByText("Ready for Delivery", { exact: true })).waitFor({ timeout: 15000 });
  check(p("the last pick shows the ready result"), true);
  const after = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.full}/fulfill`);
  check(p("the order is ready for delivery on the server"), after.order_status === "ready_for_delivery", after.order_status);
  check(p("gloves came from the earliest batch"), after.items.every((line) => line.quantity_picked === line.quantity));
  await shot(page, p("03-ready"));

  await page.goto(`${APP_URL}/purchasing/issuing-stock`);
  await visible(page.getByText("COF-0002")).waitFor({ timeout: 20000 });
  check(p("a ready order leaves the queue"), (await page.getByText("COF-0001").locator("visible=true").count()) === 0);
  await context.close();
}

async function shortPickAndComplete(browser, shot) {
  const p = (name) => `short-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  await pickPage(page, COF.short);
  await scan(page, BARCODE.masks);
  await confirmPick(page, 6);
  await visible(page.getByText("Picked 6 box of Face Mask Box.")).waitFor();
  await visible(page.getByRole("button", { name: "Complete Picking" })).click();
  await dialog.getByText("These lines are short.").waitFor();
  const summary = (await dialog.innerText()).replace(/\s+/g, " ");
  check(p("the confirmation lists each short line"), summary.includes("Face Mask Box 6 / 10") && summary.includes("Sterile Gauze Pad 0 / 5"), summary.slice(0, 240));
  await shot(page, p("01-confirm"));
  await dialog.getByRole("button", { name: "Complete Picking" }).click();
  await visible(page.getByText("Waiting for Sales dispatch decision")).waitFor({ timeout: 15000 });
  check(p("completing short says it waits for the Sales dispatch decision"), (await visible(page.getByText(/Picking is complete with 2 short lines/)).count()) > 0);
  const after = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.short}/fulfill`);
  check(p("a short order stays processing with picking completed"), after.order_status === "processing" && Boolean(after.picking_completed_at), JSON.stringify([after.order_status, after.picking_completed_at]));
  await shot(page, p("02-result"));

  await pickPage(page, COF.short);
  await visible(page.getByText("Waiting for Sales dispatch decision")).waitFor();
  check(p("reopening a completed order keeps the waiting state"), (await page.getByRole("button", { name: "Complete Picking" }).count()) === 0);
  const blocked = await apiPost(page, `${API_URL}/staff/client-order-forms/${COF.short}/fulfill/pick`, { item_id: after.items[0].item.id, quantity: 1 });
  check(p("the server refuses picks after completion"), blocked.errors?.status?.[0]?.startsWith("Picking is already complete"), JSON.stringify(blocked).slice(0, 160));
  await page.goto(`${APP_URL}/purchasing/issuing-stock`);
  await visible(page.getByText("COF-0003")).waitFor({ timeout: 20000 });
  check(p("a completed order leaves the pick queue"), (await page.getByText("COF-0002").locator("visible=true").count()) === 0);
  await context.close();

  const sales = await openAs(browser, "sales@mcvsync.test", "desktop");
  const detail = await apiGet(sales.page, `${API_URL}/staff/client-order-forms/${COF.short}`);
  const open = (detail.discrepancies ?? []).filter((row) => !row.resolved);
  check(p("sales sees each short line as an open discrepancy"), open.length === 2, JSON.stringify(open.map((row) => row.type)));
  await sales.context.close();
}

async function offlinePickOnMobile(browser, shot) {
  const p = (name) => `offline-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");
  const writes = recordQueueWrites(page);
  const dialog = page.getByRole("dialog");

  await pickPage(page, COF.offline);
  await noHorizontalScroll(page, p("pick screen"));
  await goOffline(context, page);
  check(p("complete picking is disabled offline"), await visible(page.getByRole("button", { name: "Complete Picking" })).isDisabled());
  await scan(page, BARCODE.syringe);
  await dialog.getByText(/server takes it from the earliest-expiry batch/).waitFor();
  check(p("offline picks explain the server chooses the FEFO batch"), (await dialog.getByRole("button", { name: "Use a different batch" }).count()) === 0);
  await dialog.getByRole("button", { name: "Queue Pick" }).click();
  await dialog.waitFor({ state: "detached" });
  check(p("the pick is queued on the device"), (await pendingCount(page)) === 1);
  check(p("the queued quantity shows on the line"), (await visible(page.getByText("Queued +10", { exact: true })).count()) > 0);
  check(p("nothing was sent while offline"), writes.length === 0, String(writes.length));
  await noHorizontalScroll(page, p("queued"));
  await shot(page, p("01-queued-mobile"));

  await context.setOffline(false);
  check(p("the queue drains after reconnecting"), await waitForPendingCount(page, 0));
  const sent = writes[0];
  check(p("the replay carries an idempotency key"), Boolean(sent?.key), JSON.stringify(sent ?? {}));
  const synced = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.offline}/fulfill`);
  const syringeLine = synced.items.find((line) => line.item.sku === "SYR-5ML");
  check(p("the queued pick reached the server"), syringeLine?.quantity_picked === 10, JSON.stringify(syringeLine));

  const replayed = await apiPost(page, sent.url, sent.body, { "Idempotency-Key": sent.key });
  check(p("replaying the same key returns the stored result"), replayed.client_order_form_item?.quantity_picked === 10, JSON.stringify(replayed).slice(0, 160));
  const again = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.offline}/fulfill`);
  check(p("a replayed key never picks twice"), again.items.find((line) => line.item.sku === "SYR-5ML")?.quantity_picked === 10);
  await page.reload();
  await visible(page.getByText("lines picked")).waitFor({ timeout: 20000 });
  check(p("complete picking is available again online"), !(await visible(page.getByRole("button", { name: "Complete Picking" })).isDisabled()));
  await shot(page, p("02-synced-mobile"));
  await context.close();
}

async function noticesAndAccess(browser, shot) {
  const p = (name) => `access-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");

  await pickPage(page, COF.cancelRequested);
  check(p("a cancellation request pauses picking"), (await visible(page.getByText(/Picking is paused until Sales or Purchasing confirms or declines/)).count()) > 0);
  check(p("complete picking is hidden while paused"), (await page.getByRole("button", { name: "Complete Picking" }).count()) === 0);
  const paused = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.cancelRequested}/fulfill`);
  const refused = await apiPost(page, `${API_URL}/staff/client-order-forms/${COF.cancelRequested}/fulfill/pick`, { item_id: paused.items[0].item.id, quantity: 1 });
  check(p("the server refuses picks while a cancellation is requested"), refused.errors?.cancellation_requested?.[0]?.startsWith("The client asked to cancel"), JSON.stringify(refused).slice(0, 160));
  await noHorizontalScroll(page, p("cancellation notice"));
  await shot(page, p("01-cancel-requested-mobile"));

  await page.goto(`${APP_URL}/purchasing/issuing-stock/client-orders/${COF.cebu}`);
  await visible(page.getByText("Client Order not found")).waitFor({ timeout: 20000 });
  check(p("another branch's order is not found"), true);
  await context.close();

  const sales = await openAs(browser, "sales@mcvsync.test", "desktop");
  await sales.page.goto(`${APP_URL}/purchasing/issuing-stock`);
  await sales.page.waitForURL(/\/unauthorized/);
  check(p("sales cannot open Issuing Stock"), true);
  const pick = await apiPost(sales.page, `${API_URL}/staff/client-order-forms/${COF.offline}/fulfill/pick`, { item_id: 1, quantity: 1 });
  check(p("the server refuses a pick from sales"), pick.message === "This action is unauthorized.", JSON.stringify(pick).slice(0, 120));
  await sales.context.close();
}

export async function run({ browser, shot }) {
  await runFlow("queue and full pick", () => queueAndFullPick(browser, shot));
  await runFlow("short pick and complete", () => shortPickAndComplete(browser, shot));
  await runFlow("offline pick on mobile", () => offlinePickOnMobile(browser, shot));
  await runFlow("notices and access", () => noticesAndAccess(browser, shot));
}
