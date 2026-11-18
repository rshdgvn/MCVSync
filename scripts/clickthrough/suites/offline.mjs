import { API_URL, APP_URL, apiGet, apiPost, check, noHorizontalScroll, openAs, runFlow, scan, visible } from "../lib/browser.mjs";

const BARCODE = { gloves: "4800001000011", syringe: "4800001000028", unknown: "4899999999999" };
const PENDING_LINK = 'a[aria-label$="offline changes waiting to sync"]';
const QUEUE_WRITE = /\/(receive\/confirm|receive\/discrepancy|fulfill\/pick)$/;

async function pendingCount(page) {
  const link = page.locator(PENDING_LINK).first();
  if ((await link.count()) === 0) {
    return 0;
  }
  const label = (await link.getAttribute("aria-label")) ?? "";
  return Number.parseInt(label, 10);
}

async function waitForPendingCount(page, expected, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await pendingCount(page)) === expected) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function controlledByServiceWorker(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  return page.evaluate(() => Boolean(navigator.serviceWorker.controller));
}

async function goOffline(context, page) {
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
}

function recordQueueWrites(page) {
  const writes = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && QUEUE_WRITE.test(request.url())) {
      writes.push({ url: request.url(), body: JSON.parse(request.postData() ?? "{}") });
    }
  });
  return writes;
}

async function queueReceipt(page, { batch, expiry, quantity }) {
  const dialog = page.getByRole("dialog");
  await dialog.locator("#receive-batch").waitFor();
  if (quantity) {
    await dialog.locator("#receive-quantity").fill(String(quantity));
  }
  await dialog.locator("#receive-batch").fill(batch);
  if (expiry) {
    await dialog.locator("#receive-expiry").fill(expiry);
  }
  await dialog.getByRole("button", { name: "Queue Receipt" }).click();
  await dialog.waitFor({ state: "detached" });
}

async function queuedBadge(page, quantity) {
  return (await visible(page.getByText(`Queued +${quantity}`, { exact: true })).count()) > 0;
}

async function offlinePurchaseOrderReceiving(browser, shot) {
  const p = (name) => `po offline: ${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const writes = recordQueueWrites(page);
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/stock-receiving/purchase-orders/1`);
  await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
  check(p("the service worker controls the page"), await controlledByServiceWorker(page));
  await visible(page.getByText("lines received")).waitFor();

  await goOffline(context, page);
  await visible(page.getByText(/Scans are saved on this device/)).waitFor();
  check(p("offline notice shows the last loaded time"), (await visible(page.getByText(/as last loaded/)).count()) > 0);
  check(p("complete receiving is disabled offline"), await visible(page.getByRole("button", { name: "Complete Receiving" })).isDisabled());
  check(
    p("complete receiving explains why"),
    (await visible(page.getByRole("button", { name: "Complete Receiving" })).getAttribute("title")) === "Reconnect to complete receiving",
  );

  await scan(page, BARCODE.gloves);
  await queueReceipt(page, { batch: "OFF-GLV", expiry: "2027-08-31" });
  await scan(page, BARCODE.syringe);
  await queueReceipt(page, { batch: "OFF-SYR" });
  await visible(page.getByRole("button", { name: "No barcode? Choose item" })).click();
  await dialog.getByRole("button", { name: /Gauze Pad 4x4/ }).click();
  await queueReceipt(page, { batch: "OFF-GZE", quantity: 3 });
  check(p("three lines show their queued quantity"), (await queuedBadge(page, 10)) && (await queuedBadge(page, 5)) && (await queuedBadge(page, 3)));
  check(p("top bar counts three queued changes"), (await pendingCount(page)) === 3, String(await pendingCount(page)));

  await scan(page, BARCODE.unknown);
  await visible(page.getByText(/Reconnect to log it as a discrepancy/)).waitFor();
  check(p("an unknown barcode offline asks to reconnect instead of queuing a log the server would reject"), (await pendingCount(page)) === 3);
  await noHorizontalScroll(page, p("offline session"));
  await shot(page, "offline-01-po-queued-desktop");

  await page.reload();
  await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
  check(p("the session reopens offline after a reload"), true);
  check(p("queued quantities survive the reload"), (await queuedBadge(page, 10)) && (await queuedBadge(page, 5)) && (await queuedBadge(page, 3)));
  check(p("queued count survives the reload"), (await pendingCount(page)) === 3);
  check(p("nothing was sent while offline"), writes.length === 0, String(writes.length));
  await shot(page, "offline-02-po-after-reload-desktop");

  await context.setOffline(false);
  check(p("queue drains after reconnecting"), await waitForPendingCount(page, 0));
  const order = writes.map((write) => write.body.purchase_order_item_id);
  check(p("replay keeps the scan order"), JSON.stringify(order) === JSON.stringify([1, 2, 3]), JSON.stringify(order));

  const session = await apiGet(page, `${API_URL}/staff/purchase-orders/1/receive`);
  const received = session.lines.map((line) => line.quantity_received);
  check(p("server received 10, 5 and 3"), JSON.stringify(received) === JSON.stringify([10, 5, 3]), JSON.stringify(received));
  await page.waitForFunction(() => !document.body.innerText.includes("Queued +"));
  check(p("queued badges clear after sync"), true);
  check(p("complete receiving is enabled again"), !(await visible(page.getByRole("button", { name: "Complete Receiving" })).isDisabled()));
  await shot(page, "offline-03-po-synced-desktop");
  await context.close();
}

async function offlinePickWithConflict(browser, shot) {
  const p = (name) => `pick offline: ${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");
  const writes = recordQueueWrites(page);
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/transfers/1/pick`);
  await visible(page.getByText("lines picked")).waitFor({ timeout: 20000 });
  check(p("the service worker controls the page"), await controlledByServiceWorker(page));
  await visible(page.getByText("lines picked")).waitFor();

  await goOffline(context, page);
  await scan(page, BARCODE.syringe);
  await dialog.getByText(/server takes it from the earliest-expiry batch/).waitFor();
  check(p("offline pick explains the server picks the FEFO batch"), true);
  check(p("batch override is hidden offline"), (await dialog.getByRole("button", { name: "Use a different batch" }).count()) === 0);
  check(p("quantity defaults to the remaining amount"), (await dialog.locator("#pick-quantity").inputValue()) === "10");
  await dialog.getByRole("button", { name: "Queue Pick" }).click();
  await dialog.waitFor({ state: "detached" });
  await scan(page, BARCODE.gloves);
  await dialog.getByRole("button", { name: "Queue Pick" }).click();
  await dialog.waitFor({ state: "detached" });
  check(p("both picks are queued"), (await pendingCount(page)) === 2);
  check(p("ship is disabled"), await visible(page.getByRole("button", { name: "Confirm & Mark In Transit" })).isDisabled());
  await noHorizontalScroll(page, p("offline pick session"));
  await shot(page, "offline-04-pick-queued-mobile");

  await page.reload();
  await visible(page.getByText("lines picked")).waitFor({ timeout: 20000 });
  check(p("pick session reopens offline after a reload"), (await queuedBadge(page, 10)) && (await queuedBadge(page, 8)));

  const other = await openAs(browser, "purchasing.two@mcvsync.test", "desktop");
  const transfer = await apiGet(other.page, `${API_URL}/staff/transfers/1`);
  const gloves = transfer.items.find((line) => line.item.sku === "GLV-M-100");
  const conflicting = await apiPost(other.page, `${API_URL}/staff/transfers/1/fulfill/pick`, { item_id: gloves.item.id, quantity: 8 });
  check(p("another picker takes the gloves line while this device is offline"), conflicting.quantity_picked === 8, JSON.stringify(conflicting).slice(0, 120));
  await other.context.close();

  await context.setOffline(false);
  await page.waitForFunction(() => !document.body.innerText.includes("Queued +"), null, { timeout: 30000 });
  check(p("one change stays after replay"), await waitForPendingCount(page, 1));
  const order = writes.map((write) => write.body.item_id);
  check(p("replay sends syringe then gloves"), JSON.stringify(order) === JSON.stringify([gloves.item.id + 1, gloves.item.id]), JSON.stringify(order));

  const after = await apiGet(page, `${API_URL}/staff/transfers/1`);
  const picked = Object.fromEntries(after.items.map((line) => [line.item.sku, line.quantity_picked]));
  check(p("the syringe pick synced"), picked["SYR-5ML"] === 10, JSON.stringify(picked));
  check(p("the conflicting gloves pick was not applied twice"), picked["GLV-M-100"] === 8, JSON.stringify(picked));

  await page.goto(`${APP_URL}/sync-issues`);
  const row = visible(page.getByText(/Pick 8 box of Surgical Gloves Medium for TR-0001/));
  await row.waitFor({ timeout: 20000 });
  check(p("the conflict lands in Sync Issues"), true);
  const issues = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(p("Sync Issues shows the server reason"), issues.includes("Only 0 left to pick for this item."), issues.slice(0, 300));
  await noHorizontalScroll(page, p("sync issues"));
  await shot(page, "offline-05-sync-issues-mobile");

  await page.reload();
  await row.waitFor({ timeout: 20000 });
  check(p("a failed change is never auto-resolved"), (await pendingCount(page)) === 1);
  await context.close();
}

async function offlineTransferReceiving(browser, shot) {
  const p = (name) => `transfer receive offline: ${name}`;
  const { context, page } = await openAs(browser, "cebu.purchasing@mcvsync.test", "desktop");

  await page.goto(`${APP_URL}/purchasing/stock-receiving/transfers/2`);
  await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
  check(p("the service worker controls the page"), await controlledByServiceWorker(page));
  await visible(page.getByText("lines received")).waitFor();

  await goOffline(context, page);
  await scan(page, BARCODE.gloves);
  await queueReceipt(page, { batch: "TR-GLV", expiry: "2027-06-30" });
  await page.reload();
  await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
  check(p("queued receipt survives the reload"), await queuedBadge(page, 3));
  await shot(page, "offline-06-transfer-receive-queued-desktop");

  await context.setOffline(false);
  check(p("queue drains after reconnecting"), await waitForPendingCount(page, 0));
  const transfer = await apiGet(page, `${API_URL}/staff/transfers/2`);
  check(p("server received the shipped quantity"), transfer.items[0].quantity_received === 3, String(transfer.items[0].quantity_received));
  await context.close();
}

async function liveReceivingAcrossUsers(browser, shot) {
  const p = (name) => `reverb two users: ${name}`;
  const watcher = await openAs(browser, "purchasing.two@mcvsync.test", "mobile");
  const receiver = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const progress = (page) => visible(page.getByLabel("Session progress")).textContent();

  for (const { page } of [watcher, receiver]) {
    await page.goto(`${APP_URL}/purchasing/stock-receiving/purchase-orders/2`);
    await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
  }
  check(p("both users start at 0 of 2"), (await progress(watcher.page))?.includes("0/ 2"), await progress(watcher.page));
  await watcher.page.waitForTimeout(1500);

  await scan(receiver.page, BARCODE.syringe);
  const dialog = receiver.page.getByRole("dialog");
  await dialog.locator("#receive-batch").fill("LIVE-SYR");
  await dialog.getByRole("button", { name: "Confirm Receipt" }).click();
  await dialog.waitFor({ state: "detached" });

  const updated = await watcher.page
    .waitForFunction(
      () => [...document.querySelectorAll('[aria-label="Session progress"]')].some((element) => element.textContent?.includes("1/ 2")),
      null,
      { timeout: 15000 },
    )
    .then(
      () => true,
      () => false,
    );
  check(p("the other user's open session updates live without a reload"), updated, await progress(watcher.page));
  await shot(watcher.page, "offline-07-live-update-mobile");
  await watcher.context.close();
  await receiver.context.close();
}

export async function run({ browser, shot }) {
  await runFlow("po offline", () => offlinePurchaseOrderReceiving(browser, shot));
  await runFlow("pick offline", () => offlinePickWithConflict(browser, shot));
  await runFlow("transfer receive offline", () => offlineTransferReceiving(browser, shot));
  await runFlow("reverb two users", () => liveReceivingAcrossUsers(browser, shot));
}
