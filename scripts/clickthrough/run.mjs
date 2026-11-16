import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { API_URL, APP_URL, PASSWORD, finish, screenshotter } from "./lib/browser.mjs";

const SUITES = ["receiving", "transfers", "accounting", "home"];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const apiDir = path.join(repoRoot, "api");
const appDir = path.join(repoRoot, "app");
const php = process.env.PHP_BINARY ?? "php";
const isWindows = process.platform === "win32";
const vite = path.join(appDir, "node_modules", "vite", "bin", "vite.js");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runStep(label, command, args, options) {
  console.log(`> ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}`);
  }
}

function startServer(command, args, options) {
  return spawn(command, args, { stdio: "ignore", ...options });
}

function stopServer(child) {
  if (!child.pid) {
    return;
  }
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForUrl(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`Timed out waiting for ${url}`);
}

const suite = process.argv[2];
if (!SUITES.includes(suite)) {
  fail(`Usage: node run.mjs <${SUITES.join("|")}>`);
}

const workDir = path.join(os.tmpdir(), `mcvsync-clickthrough-${suite}`);
rmSync(workDir, { recursive: true, force: true });
mkdirSync(path.join(workDir, "shots"), { recursive: true });
const database = path.join(workDir, "database.sqlite");
writeFileSync(database, "");
const distDir = path.join(workDir, "dist");
const apiEnv = {
  ...process.env,
  APP_ENV: "local",
  DB_CONNECTION: "sqlite",
  DB_DATABASE: database,
  SEED_USER_PASSWORD: PASSWORD,
};

runStep("Migrate and seed the click-through database", php, ["artisan", "migrate:fresh", "--seed", "--force"], {
  cwd: apiDir,
  env: apiEnv,
});
runStep(`Seed the ${suite} fixtures`, php, [path.join(scriptDir, "seeds", `${suite}.php`), apiDir], { cwd: apiDir, env: apiEnv });
runStep("Build the app against the local API", process.execPath, [vite, "build", "--outDir", distDir, "--emptyOutDir"], {
  cwd: appDir,
  env: { ...process.env, VITE_API_URL: API_URL },
});

const apiServer = startServer(php, ["artisan", "serve", "--port=8000"], { cwd: apiDir, env: apiEnv });
const appServer = startServer(process.execPath, [vite, "preview", "--port", "5173", "--strictPort", "--outDir", distDir], {
  cwd: appDir,
});

let failed = 1;
try {
  await waitForUrl("http://localhost:8000/up");
  await waitForUrl(APP_URL);
  const { run } = await import(`./suites/${suite}.mjs`);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    await run({ browser, shot: screenshotter(path.join(workDir, "shots")) });
  } finally {
    await browser.close();
  }
  failed = finish();
  console.log(`Screenshots: ${path.join(workDir, "shots")}`);
} finally {
  stopServer(apiServer);
  stopServer(appServer);
}
process.exit(failed === 0 ? 0 : 1);
