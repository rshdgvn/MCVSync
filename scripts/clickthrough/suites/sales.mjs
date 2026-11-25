import { API_URL, APP_URL, apiGet, check, noHorizontalScroll, openAs, pickFromCombobox, rowAction, runFlow, visible } from "../lib/browser.mjs";

const COF = { review: 1, short: 2, awaiting: 3, sendBack: 4, cancel: 5, manual: 6 };

async function sidebarBadge(page, expected) {
  const entry = page.locator("li").filter({ has: page.getByRole("link", { name: "Purchase Orders", exact: true }) }).last();
  await entry.getByText(expected, { exact: true }).waitFor({ timeout: 15000 }).catch(() => undefined);
  return ((await entry.textContent()) ?? "").replace("Purchase Orders", "").trim();
}

async function intakeAndManualCof(browser, shot) {
  const p = (name) => `intake-desktop-${name}`;
  const { context, page } = await openAs(browser, "sales@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/sales/intake`);
  const aged = visible(page.getByRole("row").filter({ hasText: "Bayanihan Clinic" }));
  await aged.waitFor({ timeout: 20000 });
  check(p("an unconverted message over 24 hours shows its age"), (await aged.getByText("2 days").count()) === 1);
  const badgeBefore = await sidebarBadge(page, "1");
  check(p("the sidebar counts unconverted messages"), badgeBefore === "1", badgeBefore);
  await noHorizontalScroll(page, p("list"));
  await shot(page, p("01-list"));

  await visible(page.getByRole("button", { name: "Log Message" })).click();
  await dialog.getByRole("button", { name: "Log Message" }).click();
  check(p("logging needs a client, channel and attachment"), (await dialog.getByText("Attach the screenshot or file the client sent.").count()) === 1);
  await pickFromCombobox(page, "message-client", "Search Client", "Client Demo", /Client Demo/);
  await page.locator("#message-channel").click();
  await page.getByRole("option", { name: "Messenger" }).click();
  await dialog.locator("#message-attachment").setInputFiles({ name: "order.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 click-through") });
  await dialog.locator("#message-notes").fill("Sent through Messenger after hours.");
  await shot(page, p("02-log-dialog"));
  await dialog.getByRole("button", { name: "Log Message" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Sent through Messenger after hours.")).waitFor();
  const badgeAfter = await sidebarBadge(page, "2");
  check(p("a logged message joins the list and the badge"), badgeAfter === "2", badgeAfter);

  await rowAction(page, aged, "desktop", "Convert to COF");
  await page.waitForURL(/\/sales\/cofs\/new\?/);
  await visible(page.getByText("Bayanihan Clinic")).waitFor();
  await page.locator("#cof-message").filter({ hasText: "bayanihan-order.pdf" }).waitFor({ timeout: 15000 });
  check(p("convert prefills the client and the message"), true);
  await pickFromCombobox(page, "cof-add-item", "Search Item", "Gloves", /Surgical Gloves Medium/);
  await page.locator("#cof-terms").fill("15 Days");
  await shot(page, p("03-manual-cof"));
  await visible(page.getByRole("button", { name: "Save COF" })).click();
  await page.waitForURL(new RegExp(`/sales/cofs/${COF.manual}$`));
  await visible(page.getByText("Logged Message (read-only)")).waitFor();
  const manual = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.manual}`);
  check(
    p("the manual COF links its message and waits for review"),
    manual.source_type === "manual" && manual.order_status === "pending_approval" && manual.source_message?.channel === "viber" && manual.terms === "15 Days",
    `${manual.source_type} ${manual.order_status} ${manual.terms}`,
  );
  const messages = await apiGet(page, `${API_URL}/staff/incoming-messages?status=converted`);
  check(p("the message shows as converted to the COF"), messages.data[0]?.converted_cof_id === COF.manual, JSON.stringify(messages.data[0]?.converted_cof_id));
  await context.close();
}

async function reviewAndForward(browser, shot) {
  const p = (name) => `review-desktop-${name}`;
  const { context, page } = await openAs(browser, "sales@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/sales/cofs/${COF.review}`);
  await visible(page.getByText("Client's Submission (read-only)")).waitFor({ timeout: 20000 });
  check(p("a matching portal order says so"), (await visible(page.getByText("Matches client's submission — 2/2 items")).count()) === 1);
  check(p("the standing discount pre-fills the line"), (await visible(page.getByLabel("Discount for Surgical Gloves Medium")).inputValue()) === "5");
  check(p("prices come from Accounting, read-only"), (await visible(page.getByText("₱120.00")).count()) === 1);
  await noHorizontalScroll(page, p("review"));
  await shot(page, p("01-review"));

  const quantity = visible(page.getByLabel("Quantity of Surgical Gloves Medium", { exact: true }));
  await quantity.fill("8");
  await quantity.blur();
  await visible(page.getByText("Differs from request (10)")).waitFor();
  check(p("editing a portal line flags it"), (await visible(page.getByText("1 of 2 items differ from the client's submission")).count()) === 1);
  check(p("forward waits for unsaved changes"), await visible(page.getByRole("button", { name: "Forward to Purchasing" })).isDisabled());
  await visible(page.getByRole("button", { name: "Save" })).click();
  await visible(page.getByText("Add a reason for each line that differs from the client's request.")).first().waitFor();
  check(p("saving a changed line needs a reason"), true);
  await visible(page.getByLabel("Reason for changing Surgical Gloves Medium")).fill("Only 8 boxes left this week.");
  await visible(page.getByRole("button", { name: "Save" })).click();
  await visible(page.getByText("COF-0001 saved.")).waitFor();
  await shot(page, p("02-saved"));

  await visible(page.getByRole("button", { name: "Forward to Purchasing" })).click();
  await dialog.getByRole("button", { name: "Forward to Purchasing" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Picked / Ordered")).waitFor();
  const forwarded = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.review}`);
  const gloves = forwarded.items.find((line) => line.quantity === 8);
  check(
    p("forwarding locks the price with the discount and starts processing"),
    forwarded.order_status === "processing" && gloves?.unit_cost === 120 && gloves?.total === 912 && gloves?.differs_from_request === true,
    `${forwarded.order_status} ${gloves?.unit_cost} ${gloves?.total}`,
  );
  await shot(page, p("03-processing"));

  await page.goto(`${APP_URL}/sales/cofs/${COF.short}`);
  await visible(page.getByRole("button", { name: "Forward to Purchasing" })).click();
  await dialog.getByRole("button", { name: "Forward to Purchasing" }).click();
  await page.getByRole("dialog", { name: "Not Enough Stock to Forward" }).waitFor();
  const panel = (await page.getByRole("dialog", { name: "Not Enough Stock to Forward" }).textContent()) ?? "";
  check(p("a short forward shows the shortage and the draft PO"), panel.includes("10 box") && panel.includes("3 box") && panel.includes("7 box") && panel.includes("draft supplier PO"), panel);
  await shot(page, p("04-shortage"));
  await page.getByRole("button", { name: "Close" }).first().click();
  const short = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.short}`);
  check(p("a short forward leaves the order pending"), short.order_status === "pending_approval", short.order_status);

  await page.goto(`${APP_URL}/sales/cofs/${COF.awaiting}`);
  await visible(page.getByText("Awaiting Accounting", { exact: true })).waitFor();
  const forward = visible(page.getByRole("button", { name: "Forward to Purchasing" }));
  check(p("an unpriced line blocks forwarding"), (await forward.isDisabled()) && ((await forward.getAttribute("title")) ?? "").includes("Awaiting Accounting"), await forward.getAttribute("title"));
  await context.close();
}

async function sendBackOnMobile(browser, shot) {
  const p = (name) => `revision-mobile-${name}`;
  const { context, page } = await openAs(browser, "sales@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/sales/cofs/${COF.sendBack}`);
  await visible(page.getByRole("tab", { name: "Source" })).waitFor({ timeout: 20000 });
  await page.getByRole("tab", { name: "Source" }).click();
  await visible(page.getByText("Client's Submission (read-only)")).waitFor();
  check(p("mobile shows source and COF as tabs"), true);
  await noHorizontalScroll(page, p("review"));
  await shot(page, p("01-source-tab"));

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Send Back for Revision" }).click();
  await dialog.getByRole("button", { name: "Send Back" }).click();
  await dialog.getByText("Tell the client what to change.").waitFor();
  check(p("sending back needs a reason"), true);
  await dialog.locator("#revision-reason").fill("Please confirm 5 boxes or 5 pieces.");
  await shot(page, p("02-reason"));
  await dialog.getByRole("button", { name: "Send Back" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Please confirm 5 boxes or 5 pieces.")).waitFor();
  const revised = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.sendBack}`);
  check(p("the order waits for the client"), revised.order_status === "needs_revision", revised.order_status);
  await noHorizontalScroll(page, p("needs revision"));
  await context.close();
}

async function cancellationOnMobile(browser, shot) {
  const p = (name) => `cancellation-mobile-${name}`;
  const { context, page } = await openAs(browser, "sales@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/sales/cofs/${COF.cancel}`);
  await visible(page.getByText("The client asked to cancel this order.")).waitFor({ timeout: 20000 });
  check(p("picking already started is explained"), (await visible(page.getByText(/returns the picked stock to its batches/)).count()) === 1);
  check(p("picked lines show progress"), (await visible(page.getByText("4 / 4")).count()) >= 1);
  await noHorizontalScroll(page, p("detail"));
  await shot(page, p("01-detail"));

  await page.getByRole("button", { name: "More actions" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Download DR" }).click()]);
  check(p("the DR downloads by its number"), download.suggestedFilename() === "DR-0001.pdf", download.suggestedFilename());

  await visible(page.getByRole("button", { name: "Confirm Cancellation" })).click();
  await dialog.getByRole("button", { name: "Cancel Order" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Cancelled", { exact: true })).first().waitFor();
  const cancelled = await apiGet(page, `${API_URL}/staff/client-order-forms/${COF.cancel}`);
  check(p("confirming cancels and voids the DR"), cancelled.order_status === "cancelled" && cancelled.dr_number === null, `${cancelled.order_status} ${cancelled.dr_number}`);
  await shot(page, p("02-cancelled"));
  await context.close();
}

async function listAndRoles(browser, shot) {
  const p = (name) => `list-${name}`;
  const { context, page } = await openAs(browser, "sales@mcvsync.test", "desktop");

  await page.goto(`${APP_URL}/sales/cofs`);
  await visible(page.getByText("COF-0002")).waitFor({ timeout: 20000 });
  const tabs = await page.getByRole("tab").allTextContents();
  check(p("status tabs carry counts"), tabs[0]?.startsWith("All COFs") && tabs.some((tab) => tab.startsWith("Pending Approval")), tabs.join(" | "));
  const pendingRow = visible(page.getByRole("row").filter({ hasText: "COF-0002" }));
  check(p("the total stays blank until forwarded"), ((await pendingRow.textContent()) ?? "").includes("—"));
  await page.getByRole("tab", { name: /^Cancelled/ }).click();
  await page.getByText("COF-0002").locator("visible=true").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
  await visible(page.getByText("COF-0005")).waitFor();
  check(p("a status tab filters the list"), (await page.getByText("COF-0002").locator("visible=true").count()) === 0);
  await shot(page, p("01-cancelled-tab"));
  await context.close();

  const accounting = await openAs(browser, "accounting@mcvsync.test", "desktop");
  await accounting.page.goto(`${APP_URL}/sales/cofs/${COF.short}`);
  await visible(accounting.page.getByText("Generated COF")).waitFor({ timeout: 20000 });
  check(p("accounting reads a COF without editing it"), (await accounting.page.getByRole("button", { name: "Save" }).count()) === 0 && (await accounting.page.getByRole("button", { name: "Forward to Purchasing" }).count()) === 0);
  await accounting.context.close();

  const purchasing = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  await purchasing.page.goto(`${APP_URL}/sales/cofs`);
  await purchasing.page.waitForURL(/\/unauthorized/);
  check(p("purchasing cannot open the Sales COF screens"), true);
  await purchasing.context.close();
}

export async function run({ browser, shot }) {
  await runFlow("intake and manual COF", () => intakeAndManualCof(browser, shot));
  await runFlow("review and forward", () => reviewAndForward(browser, shot));
  await runFlow("send back on mobile", () => sendBackOnMobile(browser, shot));
  await runFlow("cancellation on mobile", () => cancellationOnMobile(browser, shot));
  await runFlow("list and roles", () => listAndRoles(browser, shot));
}
