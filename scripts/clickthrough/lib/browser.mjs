import path from "node:path";

export const APP_URL = "http://localhost:5173";
export const API_URL = "http://localhost:8000/api";
export const PASSWORD = "Clickthrough-2026";
export const VIEWPORTS = {
  mobile: { width: 360, height: 740 },
  desktop: { width: 1440, height: 900 },
};

const results = [];
const pageErrors = [];

export function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}

export function finish() {
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | "));
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed;
}

export const visible = (locator) => locator.locator("visible=true").first();

export async function openAs(browser, email, mode) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[mode],
    isMobile: mode === "mobile",
    hasTouch: mode === "mobile",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${email}/${mode}: ${error.message}`));
  await page.goto(`${APP_URL}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  return { context, page };
}

export async function apiGet(page, url) {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { credentials: "include", headers: { Accept: "application/json" } });
    return response.json();
  }, url);
}

export async function apiPost(page, url) {
  return page.evaluate(async (target) => {
    await fetch("http://localhost:8000/sanctum/csrf-cookie", { credentials: "include" });
    const token = decodeURIComponent(
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="))
        ?.split("=")[1] ?? "",
    );
    const response = await fetch(target, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "X-XSRF-TOKEN": token },
    });
    return response.json();
  }, url);
}

export async function noHorizontalScroll(page, label) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  check(`${label}: no horizontal scroll`, scrollWidth <= innerWidth, `${scrollWidth} <= ${innerWidth}`);
}

export function screenshotter(directory) {
  return (page, name) => page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

export async function scan(page, code) {
  const input = page.getByLabel("Barcode");
  await input.fill(code);
  await input.press("Enter");
}

export async function runFlow(label, flow) {
  try {
    await flow();
  } catch (error) {
    check(`${label} flow completed`, false, error.message.split("\n")[0]);
  }
}
