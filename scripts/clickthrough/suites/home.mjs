import { API_URL, APP_URL, apiGet, check, noHorizontalScroll, openAs, runFlow, visible } from "../lib/browser.mjs";

async function cardValue(page, label) {
  const text = (await visible(page.getByRole("link", { name: new RegExp(`^${label}`) })).textContent()) ?? "";
  return text.replace(label, "").match(/\d+\+?/)?.[0] ?? "";
}

async function mainBranchHome(browser, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", mode);

  await page.goto(`${APP_URL}/`);
  await visible(page.getByText("Purchasing Home")).waitFor({ timeout: 20000 });
  await visible(page.getByText("Needs Action")).waitFor();
  await visible(page.getByRole("link", { name: /^Unresolved Discrepancies/ })).waitFor();

  const expiring = await apiGet(page, `${API_URL}/staff/inventory/alerts/expiring?per_page=1`);
  const lowStock = await apiGet(page, `${API_URL}/staff/inventory/alerts/low-stock?per_page=100`);
  const orders = await apiGet(page, `${API_URL}/staff/purchase-orders?status=ready_for_delivery&per_page=1`);
  const transfers = await apiGet(page, `${API_URL}/staff/transfers?status=pending&per_page=1`);
  const discrepancies = await apiGet(page, `${API_URL}/staff/discrepancies?resolved=0&per_page=1`);
  const outOfStock = lowStock.data.filter((row) => row.available <= 0).length;

  check(p("near expiry card matches the server"), (await cardValue(page, "Near Expiry")) === String(expiring.meta.total));
  check(p("low stock card matches the server"), (await cardValue(page, "Low Stock")) === String(lowStock.meta.total));
  check(p("out of stock card counts items with nothing available"), (await cardValue(page, "Out of Stock")) === String(outOfStock), String(outOfStock));
  check(p("ready to receive card matches the server"), (await cardValue(page, "POs Ready to Receive")) === String(orders.counts.ready_for_delivery));
  check(p("main branch sees transfers to fulfill"), (await cardValue(page, "Transfers to Fulfill")) === String(transfers.counts.pending));
  check(p("unresolved discrepancies card matches the server"), (await cardValue(page, "Unresolved Discrepancies")) === String(discrepancies.counts.unresolved));
  await noHorizontalScroll(page, p("home"));
  await shot(page, p("01-home"));

  const entries = page.getByRole("region", { name: "Needs action" }).getByRole("link");
  const firstEntry = (await entries.first().textContent()) ?? "";
  const secondEntry = (await entries.nth(1).textContent()) ?? "";
  check(p("needs action starts with the oldest ready PO"), firstEntry.includes("Ready to Receive") && firstEntry.includes("PO-0001"), firstEntry);
  check(p("the older discrepancy comes before newer items"), secondEntry.includes("Discrepancy"), secondEntry);
  await entries.first().click();
  await page.waitForURL(/\/purchasing\/stock-receiving\/purchase-orders\/\d+$/);
  check(p("a needs action entry opens its work screen"), true);

  await page.goto(`${APP_URL}/`);
  await visible(page.getByRole("link", { name: /^Unresolved Discrepancies/ })).click();
  await page.waitForURL(/\/purchasing\/discrepancies$/);
  check(p("a card opens its filtered list"), true);
  await context.close();
}

async function requestingBranchHome(browser, shot) {
  const { context, page } = await openAs(browser, "cebu.purchasing@mcvsync.test", "mobile");
  await page.goto(`${APP_URL}/`);
  await visible(page.getByRole("link", { name: /^Shipments to Receive/ })).waitFor({ timeout: 20000 });
  check("non-main branch sees shipments to receive", (await cardValue(page, "Shipments to Receive")) === "1");
  await shot(page, "cebu-home");
  await visible(page.getByRole("link", { name: /^Shipments to Receive/ })).click();
  await page.waitForURL(/\/purchasing\/stock-receiving\?tab=transfers$/);
  const selected = await page.getByRole("tab", { name: /In Transit Transfers/ }).getAttribute("aria-selected");
  check("shipments card opens the in transit transfers tab", selected === "true", String(selected));
  await context.close();
}

async function otherRolesKeepTheirHome(browser) {
  const { context, page } = await openAs(browser, "accounting@mcvsync.test", "desktop");
  await page.goto(`${APP_URL}/`);
  await visible(page.getByText(/^Welcome, /)).waitFor({ timeout: 20000 });
  check("accounting keeps the regular home page", (await page.getByText("Purchasing Home").count()) === 0);
  await context.close();
}

export async function run({ browser, shot }) {
  await runFlow("mobile main branch home", () => mainBranchHome(browser, "mobile", shot));
  await runFlow("desktop main branch home", () => mainBranchHome(browser, "desktop", shot));
  await runFlow("requesting branch home", () => requestingBranchHome(browser, shot));
  await runFlow("other roles", () => otherRolesKeepTheirHome(browser));
}
