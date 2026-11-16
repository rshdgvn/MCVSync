import { API_URL, APP_URL, apiGet, check, noHorizontalScroll, openAs, runFlow, scan, visible } from "../lib/browser.mjs";

const BARCODE = { gloves: "4800001000011", faceShield: "4800001000042" };
const ORDERS = {
  mobile: { mixed: { id: 1, number: "PO-0001" }, full: { id: 2, number: "PO-0002" } },
  desktop: { mixed: { id: 3, number: "PO-0003" }, full: { id: 4, number: "PO-0004" } },
};

async function receive(dialog, { quantity, batch, expiry }) {
  await dialog.getByText("Item Found").waitFor();
  if (quantity !== undefined) {
    await dialog.locator("#receive-quantity").fill(String(quantity));
  }
  await dialog.locator("#receive-batch").fill(batch);
  if (expiry) {
    await dialog.locator("#receive-expiry").fill(expiry);
  }
  await dialog.getByRole("button", { name: "Confirm Receipt" }).click();
}

async function openSession(page, order) {
  await page.goto(`${APP_URL}/purchasing/stock-receiving/purchase-orders/${order.id}`);
  await visible(page.getByText("lines received")).waitFor({ timeout: 20000 });
}

async function mixedReceipt(page, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  const order = ORDERS[mode].mixed;
  const dialog = page.getByRole("dialog");

  const counts = (await apiGet(page, `${API_URL}/staff/purchase-orders?status=ready_for_delivery`)).counts;
  await page.goto(`${APP_URL}/purchasing/stock-receiving`);
  const readyTab = page.getByRole("tab", { name: /Ready for Delivery/ });
  await visible(page.getByText(order.number)).waitFor({ timeout: 20000 });
  check(p("picker counts ready POs"), ((await readyTab.textContent()) ?? "").endsWith(String(counts.ready_for_delivery)));
  await noHorizontalScroll(page, p("picker"));
  await shot(page, p("01-picker"));
  await visible(page.getByText(order.number)).click();
  await page.waitForURL(new RegExp(`/stock-receiving/purchase-orders/${order.id}$`));
  await visible(page.getByText("lines received")).waitFor();
  check(p("session starts at 0 of 2"), (await visible(page.getByLabel("Session progress")).textContent())?.includes("0/ 2"));
  await noHorizontalScroll(page, p("session"));

  await scan(page, "999999");
  await visible(page.getByText("No item matches this barcode.")).waitFor();
  check(p("unknown barcode shows the server message"), true);

  await scan(page, BARCODE.faceShield);
  await dialog.getByText("Not on This Document").waitFor();
  await dialog.locator("#not-on-document-notes").fill("Two face shields arrived with this delivery.");
  await dialog.getByRole("button", { name: "Log Discrepancy" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Open Discrepancies (1)")).waitFor();
  check(p("not-on-document item is logged, not received"), true);
  await shot(page, p("02-not-on-document-logged"));

  await scan(page, BARCODE.gloves);
  await dialog.getByText("Item Found").waitFor();
  check(p("quantity defaults to the remaining amount"), (await dialog.locator("#receive-quantity").inputValue()) === "10");
  check(p("expiry asked for an item with expiry"), (await dialog.locator("#receive-expiry").count()) === 1);
  await receive(dialog, { quantity: 4, batch: "LOT-A", expiry: "2027-01-01" });
  await dialog.getByText("This batch number already exists with a different expiry date.").waitFor();
  check(p("expiry mismatch keeps the sheet open with the server message"), await dialog.isVisible());
  await shot(page, p("03-expiry-mismatch"));
  await dialog.locator("#receive-expiry").fill("2027-06-30");
  await dialog.getByRole("button", { name: "Confirm Receipt" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("4 / 10")).waitFor();
  check(p("corrected expiry receives into the existing batch"), true);
  if (mode === "mobile") {
    const toastBox = await page.getByText("Received 4 box of Surgical Gloves Medium.").boundingBox();
    check(p("toast appears at the top, clear of sheet actions"), Boolean(toastBox && toastBox.y < 120), `y ${toastBox?.y}`);
  }

  await visible(page.getByRole("button", { name: "No barcode? Choose item" })).click();
  await dialog.getByText("Choose Item").waitFor();
  await dialog.getByRole("button", { name: /Syringe 5ml/ }).click();
  await dialog.getByText("Item Found").waitFor();
  check(p("expiry hidden for an item without expiry"), (await dialog.locator("#receive-expiry").count()) === 0);
  await dialog.locator("#receive-quantity").fill("7");
  await dialog.getByText("An over discrepancy will be logged.").waitFor();
  check(p("over-quantity warning shows while typing"), true);
  await shot(page, p("04-over-warning"));
  await receive(dialog, { batch: "SYR-1" });
  await dialog.waitFor({ state: "detached" });
  const progress = await visible(page.getByLabel("Session progress")).textContent();
  check(p("header counts one short and one over"), progress?.includes("1 short") && progress?.includes("1 over"), progress);

  if (mode === "mobile") {
    await page.getByRole("tab", { name: /Confirmed/ }).click();
    const confirmed = page.getByRole("region", { name: "Confirmed Items" });
    check(p("confirmed tab lists both received lines"), (await confirmed.getByText(/Surgical Gloves Medium|Syringe 5ml/).count()) === 2);
  }

  await visible(page.getByRole("button", { name: "Complete Receiving" })).click();
  await dialog.getByText("These lines are short").waitFor();
  check(p("complete dialog lists the short line and the over-receipt"), (await dialog.getByText("4 / 10").count()) === 1 && (await dialog.getByText(/over-received/).count()) === 1);
  await shot(page, p("05-complete-confirm"));
  await dialog.getByRole("button", { name: "Complete Receiving" }).click();
  await visible(page.getByText("Still open: 1 shortfall logged, 1 line over-received need review")).waitFor();
  check(p("short and over receipt leaves the PO open with reasons"), true);
  await shot(page, p("06-result-open"));

  const logged = await apiGet(page, `${API_URL}/staff/discrepancies?reference_type=purchase_order&reference_id=${order.id}`);
  const types = logged.data.map((row) => row.type).sort();
  check(p("server logged not_found, over and short"), JSON.stringify(types) === JSON.stringify(["not_found", "over", "short"]), types.join(","));
}

async function fullReceipt(page, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  const order = ORDERS[mode].full;
  const dialog = page.getByRole("dialog");

  await openSession(page, order);
  await scan(page, BARCODE.gloves);
  await dialog.getByText("Item Found").waitFor();
  check(p("full receipt defaults to the ordered amount"), (await dialog.locator("#receive-quantity").inputValue()) === "6");
  await receive(dialog, { batch: `NEW-${mode.toUpperCase()}`, expiry: "2027-12-31" });
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByRole("button", { name: "Complete Receiving" })).click();
  await dialog.getByText(/matches what was expected/).waitFor();
  await dialog.getByRole("button", { name: "Complete Receiving" }).click();
  await visible(page.getByText("Stock Received")).waitFor();
  const closed = await apiGet(page, `${API_URL}/staff/purchase-orders/${order.id}`);
  check(p("fully matched receipt closes the PO"), closed.status === "closed", closed.status);
  await shot(page, p("07-result-closed"));

  await openSession(page, order);
  await visible(page.getByText(/isn't open for receiving/)).waitFor();
  check(p("closed PO session refuses scanning"), (await page.getByLabel("Barcode").count()) === 0);
}

async function desktopFollowUp(page, shot) {
  const dialog = page.getByRole("dialog");
  const order = ORDERS.desktop.mixed;

  await page.goto(`${APP_URL}/purchasing/discrepancies`);
  await visible(page.getByText("Two face shields arrived with this delivery.")).waitFor({ timeout: 15000 });
  await noHorizontalScroll(page, "desktop-discrepancies");
  await shot(page, "desktop-08-discrepancies");
  const row = page.getByRole("row").filter({ hasText: order.number }).filter({ hasText: "Face Shield" });
  await row.getByRole("button", { name: "Resolve" }).click();
  await dialog.locator("#resolution-note").fill("Returned to the supplier with the driver.");
  await dialog.getByRole("button", { name: "Mark Resolved" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("tab", { name: /^Resolved/ }).click();
  await visible(page.getByText("Returned to the supplier with the driver.")).waitFor();
  check("resolving moves the discrepancy to Resolved with its note", true);

  await page.goto(`${APP_URL}/purchasing/purchase-orders/${order.id}`);
  await visible(page.getByRole("link", { name: "Receive Stock" })).waitFor({ timeout: 15000 });
  await visible(page.getByRole("row").filter({ hasText: "Not on Document" })).waitFor();
  const rows = await page.getByRole("row").filter({ hasText: /Short|Over|Not on Document/ }).count();
  check("PO detail embeds its three discrepancies", rows === 3, `${rows} rows`);
  await shot(page, "desktop-09-po-detail");
}

export async function run({ browser, shot }) {
  for (const mode of ["mobile", "desktop"]) {
    const { context, page } = await openAs(browser, "purchasing@mcvsync.test", mode);
    await runFlow(`${mode} mixed receipt`, () => mixedReceipt(page, mode, shot));
    await runFlow(`${mode} full receipt`, () => fullReceipt(page, mode, shot));
    if (mode === "desktop") {
      await runFlow("desktop follow-up", () => desktopFollowUp(page, shot));
    }
    await context.close();
  }
}
