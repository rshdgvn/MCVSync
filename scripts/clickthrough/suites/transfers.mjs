import { API_URL, APP_URL, apiGet, apiPost, check, noHorizontalScroll, openAs, runFlow, scan, visible } from "../lib/browser.mjs";

const BARCODE = { gloves: "4800001000011", alcohol: "4800001000035" };

async function generateOverrideCode(browser) {
  const { context, page } = await openAs(browser, "superadmin@mcvsync.test", "desktop");
  const { code } = await apiPost(page, `${API_URL}/staff/fefo-overrides`);
  await context.close();
  return code;
}

async function chooseItem(page, dialog, name) {
  await visible(page.getByRole("button", { name: "No barcode? Choose item" })).click();
  await dialog.getByRole("button", { name: new RegExp(name) }).click();
}

async function desktopPick(browser, shot) {
  const p = (name) => `desktop-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/transfers`);
  await visible(page.getByText("TR-0004")).waitFor({ timeout: 20000 });
  const tabs = await page.getByRole("tab").allTextContents();
  check(p("main branch opens on To Approve, then To Fulfill and Shipped"), tabs[0]?.startsWith("To Approve") && tabs[0]?.endsWith("2") && tabs[1]?.startsWith("To Fulfill") && tabs[2]?.startsWith("Shipped"), tabs.join(" | "));
  await page.getByRole("tab", { name: /To Fulfill/ }).click();
  await visible(page.getByText("TR-0002")).waitFor();
  check(p("main branch has no New Transfer Request button"), (await page.getByRole("link", { name: "New Transfer Request" }).count()) === 0);
  await noHorizontalScroll(page, p("transfers list"));
  await shot(page, p("01-transfers-list"));

  await visible(page.getByText("TR-0002")).click();
  await page.waitForURL(/\/purchasing\/transfers\/2$/);
  await visible(page.getByRole("link", { name: "Prepare & Ship" })).waitFor();
  check(p("main branch cannot cancel a request"), (await page.getByRole("button", { name: "More actions" }).count()) === 0);
  await visible(page.getByRole("link", { name: "Prepare & Ship" })).click();
  await page.waitForURL(/\/purchasing\/transfers\/2\/pick$/);
  await visible(page.getByText("lines picked")).waitFor();
  check(p("ship is disabled until everything is picked"), await visible(page.getByRole("button", { name: "Confirm & Mark In Transit" })).isDisabled());

  await scan(page, BARCODE.gloves);
  await dialog.getByText("FEFO Batch (Earliest Expiry)").waitFor();
  check(p("pick sheet shows the FEFO batch"), (await dialog.getByText("GLV-EARLY").count()) > 0);
  await dialog.getByRole("button", { name: "Use a different batch" }).click();
  await dialog.getByRole("button", { name: /GLV-LATE/ }).click();
  await dialog.getByLabel("Override Code").waitFor();
  check(p("a later batch asks for an override code and reason"), true);
  await dialog.getByLabel("Override Code").fill("nope1234");
  check(p("override code input is uppercased"), (await dialog.getByLabel("Override Code").inputValue()) === "NOPE1234");
  await dialog.getByLabel("Reason").fill("Customer asked for the later lot.");
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.getByText("This override code does not exist. Check the 8 characters and try again.").waitFor();
  check(p("an unknown code shows its specific message"), true);
  await shot(page, p("02-override-error"));
  await dialog.getByLabel("Override Code").fill(await generateOverrideCode(browser));
  await dialog.getByRole("button", { name: "Confirm Pick" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  const afterOverride = await apiGet(page, `${API_URL}/staff/transfers/2`);
  check(p("override pick takes the later batch once"), afterOverride.items.find((line) => line.item.sku === "GLV-M-100").quantity_picked === 4);

  await chooseItem(page, dialog, "Syringe 5ml");
  await dialog.getByText("SYR-MAIN").waitFor();
  check(p("quantity defaults to the remaining amount"), (await dialog.locator("#pick-quantity").inputValue()) === "5");
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.waitFor({ state: "detached" });
  await noHorizontalScroll(page, p("pick session"));
  await shot(page, p("03-pick-complete"));

  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.includes("Confirm & Mark In Transit") && element.offsetParent,
    );
    return button && !button.disabled;
  });
  await visible(page.getByRole("button", { name: "Confirm & Mark In Transit" })).click();
  await dialog.getByRole("button", { name: "Confirm & Mark In Transit" }).click();
  await page.waitForURL(/\/purchasing\/transfers\/2$/);
  await visible(page.getByText("In Transit", { exact: true })).waitFor();
  check(p("shipping lands on the detail page as In Transit"), true);

  await page.goto(`${APP_URL}/purchasing/transfers/3/pick`);
  await visible(page.getByText("lines picked")).waitFor();
  await scan(page, BARCODE.alcohol);
  await dialog.getByText("Insufficient Stock").waitFor();
  const panel = await dialog.textContent();
  check(p("shortage panel shows requested, available and shortage"), panel?.includes("10 pcs") && panel?.includes("2 pcs") && panel?.includes("8 pcs"));
  await dialog.getByRole("button", { name: "Open Draft PO" }).waitFor();
  await shot(page, p("04-shortage"));
  check(p("the shortage was drafted automatically"), (await dialog.getByText(/MCVSync added it to draft PO-\d{4}/).count()) === 1);
  check(p("the shortcut opens the draft instead of creating a second PO"), (await dialog.getByRole("button", { name: "Create Supplier PO" }).count()) === 0);
  await dialog.getByRole("button", { name: "Open Draft PO" }).click();
  await page.waitForURL(/\/purchasing\/purchase-orders\/\d+$/);
  await visible(page.getByText("Generated by MCVSync because a pick was short of stock.")).waitFor();
  const finalize = visible(page.getByRole("button", { name: "Finalize PO" }));
  check(p("finalize waits for a supplier"), await finalize.isDisabled());
  check(p("an unbought item needs a cost"), (await visible(page.getByText("Needs cost")).count()) === 1);
  await noHorizontalScroll(page, p("draft review"));
  await shot(page, p("05-shortage-draft"));

  await page.locator("#draft-supplier").click();
  await page.getByLabel("Search Supplier").fill("Acme");
  await visible(page.getByRole("option", { name: "Acme Medical Supplies" })).locator("button").click();
  await visible(page.getByText("Supplier set to Acme Medical Supplies.")).waitFor();
  await visible(page.getByRole("button", { name: "Edit" })).click();
  check(p("draft quantity is the shortage"), (await dialog.locator("#po-line-quantity").inputValue()) === "8");
  await dialog.locator("#po-line-unit-cost").fill("95");
  await dialog.getByRole("button", { name: "Save Item" }).click();
  await dialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === "Finalize PO" && element.offsetParent);
    return button && !button.disabled;
  });
  await finalize.click();
  await dialog.getByRole("button", { name: "Finalize PO" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Open", { exact: true })).waitFor();
  const orderId = Number(page.url().split("/").pop());
  const finalized = await apiGet(page, `${API_URL}/staff/purchase-orders/${orderId}`);
  check(
    p("finalizing opens the draft for the main branch with who finalized it"),
    finalized.status === "open" && finalized.source === "auto_shortage" && finalized.branch.is_main === true && finalized.total === 760 && finalized.prepared_by !== null,
    `${finalized.status} ${finalized.total} ${finalized.prepared_by}`,
  );

  await context.close();
}

async function mobilePick(browser, shot) {
  const p = (name) => `mobile-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/transfers/1/pick`);
  await visible(page.getByText("lines picked")).waitFor({ timeout: 20000 });
  await noHorizontalScroll(page, p("pick session"));
  await scan(page, BARCODE.gloves);
  await dialog.getByText("GLV-EARLY").waitFor();
  check(p("quantity is capped to the FEFO batch"), (await dialog.locator("#pick-quantity").inputValue()) === "6");
  check(p("sheet explains picking the rest from the next batch"), (await dialog.getByText(/pick the rest from the next batch/).count()) === 1);
  await shot(page, p("01-pick-sheet"));
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.waitFor({ state: "detached" });

  await scan(page, BARCODE.gloves);
  await dialog.getByText("GLV-LATE").waitFor();
  check(p("next scan moves to the next batch for the rest"), (await dialog.locator("#pick-quantity").inputValue()) === "2");
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.waitFor({ state: "detached" });

  await chooseItem(page, dialog, "Syringe 5ml");
  await dialog.getByText("SYR-MAIN").waitFor();
  await dialog.getByRole("button", { name: "Confirm Pick" }).click();
  await dialog.waitFor({ state: "detached" });

  await page.getByRole("tab", { name: /Picked/ }).click();
  check(p("picked tab lists both lines"), (await page.getByRole("region", { name: "Picked Items" }).getByText(/Surgical Gloves Medium|Syringe 5ml/).count()) === 2);
  await visible(page.getByRole("button", { name: "Confirm & Mark In Transit" })).click();
  await dialog.getByRole("button", { name: "Confirm & Mark In Transit" }).click();
  await page.waitForURL(/\/purchasing\/transfers\/1$/);
  await visible(page.getByText("In Transit", { exact: true })).waitFor();
  await noHorizontalScroll(page, p("transfer detail"));
  await shot(page, p("02-detail-in-transit"));
  check(p("shipped from mobile"), true);
  await context.close();
}

async function requestingBranch(browser, shot) {
  const p = (name) => `cebu-${name}`;
  const { context, page } = await openAs(browser, "cebu.purchasing@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/transfers`);
  await visible(page.getByText("TR-0001")).waitFor({ timeout: 20000 });
  const tabs = await page.getByRole("tab").allTextContents();
  check(p("requesting branch gets My Requests"), tabs.length === 1 && tabs[0].startsWith("My Requests"), tabs.join(" | "));

  await visible(page.getByRole("link", { name: "New Transfer Request" })).click();
  await page.getByText("New Transfer Request").first().waitFor();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await visible(page.getByRole("button", { name: "Add Item" })).click();
    await page.locator("#transfer-line-item").click();
    await page.getByLabel("Search Item").fill("Face");
    await visible(page.getByRole("option", { name: /Face Shield/ })).locator("button").click();
    if (attempt === 0) {
      await dialog.locator("#transfer-line-quantity").fill("3");
    }
    await dialog.getByRole("button", { name: "Add Item" }).click();
    if (attempt === 0) {
      await dialog.waitFor({ state: "detached" });
    }
  }
  await dialog.getByText("This item is already on the request. Edit its quantity instead.").waitFor();
  check(p("the same item cannot be added twice"), true);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await noHorizontalScroll(page, p("new request"));
  await shot(page, p("01-new-request"));
  await visible(page.getByRole("button", { name: "Submit Request" })).click();
  await page.waitForURL(/\/purchasing\/transfers\/\d+$/);
  await visible(page.getByText("Awaiting Approval", { exact: true })).waitFor();
  check(p("a new request waits for approval"), true);

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Cancel Transfer" }).click();
  await dialog.getByText(/reserved for it at Apalit is released/).waitFor();
  await dialog.getByRole("button", { name: "Cancel Transfer" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Cancelled", { exact: true })).waitFor();
  check(p("requesting branch cancels while awaiting approval"), true);

  await page.goto(`${APP_URL}/purchasing/stock-receiving`);
  const transitTab = page.getByRole("tab", { name: /In Transit Transfers/ });
  await transitTab.click();
  await visible(page.getByText("TR-0001")).waitFor();
  check(p("in transit tab lists shipped transfers"), /2$/.test((await transitTab.textContent()) ?? ""), await transitTab.textContent());
  await visible(page.getByText("TR-0001")).click();
  await page.waitForURL(/\/stock-receiving\/transfers\/1$/);
  await visible(page.getByText("lines received")).waitFor();

  await scan(page, BARCODE.gloves);
  await dialog.getByText("Item Found").waitFor();
  check(p("receive sheet compares against what was shipped"), (await dialog.getByText("Shipped").count()) === 1 && (await dialog.locator("#receive-quantity").inputValue()) === "8");
  await dialog.locator("#receive-batch").fill("CEBU-G1");
  await dialog.locator("#receive-expiry").fill("2027-09-30");
  await dialog.getByRole("button", { name: "Confirm Receipt" }).click();
  await dialog.waitFor({ state: "detached" });
  await chooseItem(page, dialog, "Syringe 5ml");
  await dialog.getByText("Item Found").waitFor();
  await dialog.locator("#receive-batch").fill("CEBU-S1");
  await dialog.getByRole("button", { name: "Confirm Receipt" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByRole("button", { name: "Complete Receiving" })).click();
  await dialog.getByRole("button", { name: "Complete Receiving" }).click();
  await visible(page.getByText("Stock Received")).waitFor();
  const received = await apiGet(page, `${API_URL}/staff/transfers/1`);
  check(p("full receipt closes the transfer"), received.status === "closed", received.status);
  await shot(page, p("02-receive-closed"));
  await context.close();
}

async function shortAccepted(browser, shot) {
  const p = (name) => `short-accepted-mobile-${name}`;
  const { context, page } = await openAs(browser, "cebu.purchasing@mcvsync.test", "mobile");

  await page.goto(`${APP_URL}/purchasing/transfers/6`);
  await visible(page.getByText("3 received · 2 short accepted")).waitFor({ timeout: 20000 });
  check(p("the transfer line shows the accepted shortfall"), true);
  check(p("accepting the only gap received the transfer"), (await visible(page.getByText("Received", { exact: true })).count()) >= 1);
  await noHorizontalScroll(page, p("detail"));
  await shot(page, p("01-detail"));
  await context.close();
}

async function superAdmin(browser, shot) {
  const { context, page } = await openAs(browser, "superadmin@mcvsync.test", "mobile");
  await page.goto(`${APP_URL}/super-admin/fefo-override`);
  await visible(page.getByRole("button", { name: "Generate Code" })).click();
  await visible(page.getByText(/Expires in 1[45]:\d{2}/)).waitFor();
  const code = (await visible(page.getByText(/^[A-Z0-9]{8}$/)).textContent()) ?? "";
  check("super admin sees an 8-character code with a countdown", code.length === 8, code);
  await noHorizontalScroll(page, "superadmin-fefo");
  await shot(page, "superadmin-fefo");
  await context.close();
}

async function draftReview(browser, shot) {
  const p = (name) => `draft-mobile-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/purchase-orders?status=draft`);
  const draftTab = page.getByRole("tab", { name: /^Draft/ });
  await draftTab.waitFor({ timeout: 20000 });
  check(p("the draft tab opens from the link"), (await draftTab.getAttribute("aria-selected")) === "true");
  await visible(page.getByText("Auto: Low Stock")).first().waitFor();
  check(p("low stock drafts carry a source badge"), true);
  await noHorizontalScroll(page, p("draft list"));
  await shot(page, p("01-draft-list"));

  await visible(page.getByText("PO-0002")).click();
  await page.waitForURL(/\/purchasing\/purchase-orders\/\d+$/);
  await visible(page.getByText("Generated by MCVSync because stock fell to the reorder point.")).waitFor();
  const draft = await apiGet(page, `${API_URL}/staff/purchase-orders/${page.url().split("/").pop()}`);
  check(
    p("the draft uses the preferred supplier, reorder quantity and last paid cost"),
    draft.supplier?.name === "Acme Medical Supplies" && draft.items[0]?.quantity_ordered === 25 && draft.items[0]?.unit_cost === 30,
    `${draft.supplier?.name} ${draft.items[0]?.quantity_ordered} ${draft.items[0]?.unit_cost}`,
  );
  check(p("a ready draft can be finalized"), !(await visible(page.getByRole("button", { name: "Finalize PO" })).isDisabled()));
  check(p("nobody prepared it yet"), (await page.getByText("MCVSync", { exact: true }).count()) >= 1);
  await noHorizontalScroll(page, p("draft detail"));
  await shot(page, p("02-draft-detail"));

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Discard Draft" }).click();
  await dialog.getByRole("button", { name: "Discard Draft" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Cancelled", { exact: true })).waitFor();
  check(p("discarding cancels the draft"), true);
  await context.close();
}

async function approveRequest(browser, shot) {
  const p = (name) => `approve-desktop-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "desktop");
  const dialog = page.getByRole("dialog");

  await page.goto(`${APP_URL}/purchasing/transfers`);
  await visible(page.getByText("TR-0004")).click();
  await page.waitForURL(/\/purchasing\/transfers\/4$/);
  await visible(page.getByText("Awaiting Approval", { exact: true })).waitFor();
  check(p("an awaiting request offers Approve and Decline"), (await visible(page.getByRole("button", { name: "Approve" })).count()) === 1 && (await visible(page.getByRole("button", { name: "Decline" })).count()) === 1);
  check(p("an awaiting request cannot be picked yet"), (await page.getByRole("link", { name: "Prepare & Ship" }).count()) === 0);
  await noHorizontalScroll(page, p("awaiting detail"));
  await shot(page, "approve-01-awaiting-desktop");

  await visible(page.getByRole("button", { name: "Approve" })).click();
  await dialog.getByRole("button", { name: "Approve Request" }).dblclick();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByRole("link", { name: "Prepare & Ship" })).waitFor();
  const approved = await apiGet(page, `${API_URL}/staff/transfers/4`);
  check(p("approval moves the request to pending with who approved it"), approved.status === "pending" && Boolean(approved.decided_by) && Boolean(approved.decided_at), `${approved.status} ${approved.decided_by}`);
  await shot(page, "approve-02-approved-desktop");

  await page.goto(`${APP_URL}/purchasing/transfers`);
  await page.getByRole("tab", { name: /To Fulfill/ }).click();
  const approvedRow = page.getByRole("row", { name: /TR-0004/ });
  await approvedRow.waitFor();
  check(p("an approved request shows as Approved under To Fulfill"), (await approvedRow.getByText("Approved", { exact: true }).count()) === 1);
  await context.close();
}

async function declineRequest(browser, shot) {
  const p = (name) => `decline-mobile-${name}`;
  const { context, page } = await openAs(browser, "purchasing@mcvsync.test", "mobile");
  const dialog = page.getByRole("dialog");
  const reason = "Syringes are committed to a client order this week.";

  await page.goto(`${APP_URL}/purchasing/transfers/5`);
  await visible(page.getByRole("button", { name: "Decline" })).click();
  await dialog.getByRole("button", { name: "Decline Request" }).click();
  await dialog.getByText("Say why this request is being declined.").waitFor();
  check(p("decline needs a reason"), true);
  await noHorizontalScroll(page, p("decline sheet"));
  await shot(page, "approve-03-decline-reason-mobile");
  await dialog.locator("#decline-reason").fill(reason);
  await dialog.getByRole("button", { name: "Decline Request" }).click();
  await dialog.waitFor({ state: "detached" });
  await visible(page.getByText("Declined", { exact: true })).waitFor();
  const declined = await apiGet(page, `${API_URL}/staff/transfers/5`);
  check(p("decline ends the request with the reason"), declined.status === "declined" && declined.decline_reason === reason, declined.status);
  check(p("a declined request has no actions left"), (await page.getByRole("button", { name: "Approve" }).count()) === 0);
  await context.close();

  const cebu = await openAs(browser, "cebu.purchasing@mcvsync.test", "mobile");
  await cebu.page.goto(`${APP_URL}/purchasing/transfers/5`);
  await visible(cebu.page.getByText(reason)).waitFor({ timeout: 20000 });
  check(p("the requesting branch sees the decline reason"), true);
  check(p("the requesting branch cannot approve"), (await cebu.page.getByRole("button", { name: "Approve" }).count()) === 0);
  await noHorizontalScroll(cebu.page, p("declined detail"));
  await shot(cebu.page, "approve-04-declined-requester-mobile");
  await cebu.context.close();
}

export async function run({ browser, shot }) {
  await runFlow("desktop pick", () => desktopPick(browser, shot));
  await runFlow("mobile pick", () => mobilePick(browser, shot));
  await runFlow("requesting branch", () => requestingBranch(browser, shot));
  await runFlow("super admin", () => superAdmin(browser, shot));
  await runFlow("short accepted", () => shortAccepted(browser, shot));
  await runFlow("draft review", () => draftReview(browser, shot));
  await runFlow("approve request", () => approveRequest(browser, shot));
  await runFlow("decline request", () => declineRequest(browser, shot));
}
