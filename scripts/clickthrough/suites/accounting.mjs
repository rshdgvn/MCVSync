import {
  API_URL,
  APP_URL,
  apiGet,
  check,
  noHorizontalScroll,
  openAs,
  pickFromCombobox,
  rowAction,
  runFlow,
  visible,
} from "../lib/browser.mjs";

const NEW_PRICE = {
  mobile: { client: "Gamma Pharmacy", zoneHint: "₱530.00", srp: "500" },
  desktop: { client: "Delta Medical", zoneHint: "No prices in South Luzon yet", srp: "610" },
};
const REPRICE = { mobile: { current: "₱520.00", srp: "525" }, desktop: { current: "₱525.00", srp: "530" } };

function rowFor(page, ...texts) {
  return texts.reduce((rows, text) => rows.filter({ hasText: text }), page.locator("tr, li").locator("visible=true")).first();
}

async function itemsReference(page, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  await page.goto(`${APP_URL}/accounting/items`);
  await visible(page.getByText("Surgical Gloves Medium")).waitFor({ timeout: 20000 });
  check(p("COGS uses the most recent purchase order cost"), (await rowFor(page, "Surgical Gloves Medium").textContent())?.includes("₱470.00"));
  check(p("an item never purchased says so"), (await rowFor(page, "Face Shield").textContent())?.includes("Not purchased yet"));
  await noHorizontalScroll(page, p("items reference"));
  await shot(page, p("01-items-reference"));
}

async function clientPricing(page, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  const dialog = page.getByRole("dialog");
  const target = NEW_PRICE[mode];

  await page.goto(`${APP_URL}/accounting/client-pricing`);
  await visible(page.getByText("Alpha Hospital")).waitFor({ timeout: 20000 });
  await noHorizontalScroll(page, p("client pricing"));
  await shot(page, p("02-client-pricing"));

  await visible(page.getByRole("button", { name: "Set Price" })).click();
  await dialog.getByText("Saving always adds a new price").waitFor();
  await pickFromCombobox(page, "price-client", "Search Client", target.client.split(" ")[0], target.client);
  await pickFromCombobox(page, "price-item", "Search Item", "Gloves", "Surgical Gloves Medium · GLV-M-100");
  await dialog.getByText("Needs pricing").waitFor();
  await dialog.getByText(target.zoneHint).waitFor();
  check(p("hints show needs pricing, zone average and COGS"), (await dialog.getByText("₱470.00").count()) === 1);
  await shot(page, p("03-set-price-hints"));
  await dialog.getByRole("button", { name: "Save Price" }).click();
  await dialog.getByText("Enter an SRP of 0 or more.").waitFor();
  check(p("SRP is required"), true);
  await dialog.locator("#price-srp").fill(target.srp);
  await dialog.getByRole("button", { name: "Save Price" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  const clients = await apiGet(page, `${API_URL}/staff/pricing/clients?search=${encodeURIComponent(target.client)}`);
  const items = await apiGet(page, `${API_URL}/staff/pricing/items?search=Gloves`);
  const history = await apiGet(page, `${API_URL}/staff/pricing/client-item-prices/history?client_id=${clients.data[0].id}&item_id=${items.data[0].id}`);
  check(p("double-click saves exactly one new price"), history.meta.total === 1 && history.data[0].srp === Number(target.srp), `${history.meta.total} rows`);

  const alphaGloves = rowFor(page, "Alpha Hospital", "Surgical Gloves Medium");
  await rowAction(page, alphaGloves, mode, "Set New Price");
  await dialog.getByText(REPRICE[mode].current).first().waitFor();
  check(p("re-pricing shows the current price first"), true);
  await dialog.locator("#price-srp").fill(REPRICE[mode].srp);
  await dialog.getByRole("button", { name: "Save Price" }).click();
  await dialog.waitFor({ state: "detached" });

  await rowAction(page, rowFor(page, "Alpha Hospital", "Surgical Gloves Medium"), mode, "View History");
  await dialog.getByText("Price History").waitFor();
  const entries = dialog.locator("ol > li");
  await entries.first().waitFor();
  const firstEntry = (await entries.first().textContent()) ?? "";
  check(p("history lists newest first and marks it current"), firstEntry.includes("Current") && firstEntry.includes(`₱${REPRICE[mode].srp}.00`), firstEntry);
  check(p("old prices stay in the history"), (await entries.count()) >= 2);
  await shot(page, p("04-price-history"));
  await page.keyboard.press("Escape");
}

async function payments(page, mode, shot) {
  const p = (name) => `${mode}-${name}`;
  const dialog = page.getByRole("dialog");
  const before = await apiGet(page, `${API_URL}/staff/payments/history`);

  await page.goto(`${APP_URL}/accounting/pending-payments`);
  await visible(page.getByText("Client Order Form #9001")).waitFor({ timeout: 20000 });
  check(p("long-overdue payments show a 45 day chip"), (await rowFor(page, "Client Order Form #9001").textContent())?.includes("45 days"));
  await noHorizontalScroll(page, p("pending payments"));
  await shot(page, p("05-pending-payments"));

  const reference = mode === "mobile" ? "Client Order Form #9002" : "Client Order Form #9003";
  await rowAction(page, rowFor(page, reference), mode, "Approve");
  await dialog.getByText("Approve Payment").first().waitFor();
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await dialog.locator("#payment-date").fill(tomorrowIso);
  await dialog.getByRole("button", { name: "Confirm Payment" }).click();
  await dialog.getByText("Choose how the payment was received.").waitFor();
  check(p("a future date and missing method are blocked"), (await dialog.getByText("The date received can't be in the future.").count()) === 1);
  await dialog.locator("#payment-method").click();
  await page.getByRole("option", { name: "Check" }).click();
  const now = new Date();
  await dialog.locator("#payment-date").fill(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  await dialog.locator("#payment-note").fill(`CHK-${mode.toUpperCase()}`);
  await shot(page, p("06-approve-payment"));
  await dialog.getByRole("button", { name: "Confirm Payment" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  const after = await apiGet(page, `${API_URL}/staff/payments/history`);
  check(p("approval records exactly one payment"), after.meta.total === before.meta.total + 1, `${before.meta.total} -> ${after.meta.total}`);

  await page.goto(`${APP_URL}/accounting/payment-history`);
  await visible(page.getByText(`CHK-${mode.toUpperCase()}`)).waitFor({ timeout: 15000 });
  check(p("history shows the approved payment with its method"), (await rowFor(page, `CHK-${mode.toUpperCase()}`).textContent())?.includes("Check"));
  await shot(page, p("07-payment-history"));

  await page.goto(`${APP_URL}/accounting/pending-pricing`);
  await visible(page.getByText(/starts working once the Sales module is built/)).waitFor();
  check(p("pending pricing explains it waits for Sales"), true);
}

async function adminReadOnly(browser, shot) {
  const { context, page } = await openAs(browser, "admin@mcvsync.test", "desktop");
  await page.goto(`${APP_URL}/accounting/client-pricing`);
  await visible(page.getByText("Alpha Hospital")).waitFor({ timeout: 20000 });
  check("admin sees pricing without Set Price", (await page.getByRole("button", { name: "Set Price" }).count()) === 0);
  check("admin rows only offer View History", (await page.getByRole("button", { name: "Set New Price" }).count()) === 0 && (await page.getByRole("button", { name: "View History" }).count()) > 0);
  await page.goto(`${APP_URL}/accounting/pending-payments`);
  await visible(page.getByText("Client Order Form #9001")).waitFor();
  check("admin cannot approve payments", (await page.getByRole("button", { name: "Approve" }).count()) === 0);
  await shot(page, "admin-pending-payments");
  await context.close();
}

export async function run({ browser, shot }) {
  for (const mode of ["mobile", "desktop"]) {
    const { context, page } = await openAs(browser, "accounting@mcvsync.test", mode);
    await runFlow(`${mode} items reference`, () => itemsReference(page, mode, shot));
    await runFlow(`${mode} client pricing`, () => clientPricing(page, mode, shot));
    await runFlow(`${mode} payments`, () => payments(page, mode, shot));
    await context.close();
  }
  await runFlow("admin read-only", () => adminReadOnly(browser, shot));
}
