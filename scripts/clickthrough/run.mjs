import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { API_URL, APP_URL, PASSWORD, finish, screenshotter } from "./lib/browser.mjs";

const SUITES = ["receiving", "transfers", "accounting", "home", "offline"];
const REALTIME_SUITES = new Set(["offline"]);
const API_PORT = 8000;
const APP_PORT = 5173;
const REVERB_PORT = 8080;
const RESULT_FILE = "result.txt";
const PASSED = "passed";
const MIXED_PATH_SIGNATURE = /didn't resolve at build time/;
const scriptDir = realpathSync.native(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(scriptDir, "../..");
const apiDir = path.join(repoRoot, "api");
const appDir = path.join(repoRoot, "app");
const php = process.env.PHP_BINARY ?? "php";
const isWindows = process.platform === "win32";
const vite = path.join(appDir, "node_modules", "vite", "bin", "vite.js");

class StartupError extends Error {}

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

function portOwner(port) {
  if (isWindows) {
    const netstat = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout ?? "";
    const line = netstat.split(/\r?\n/).find((row) => /LISTENING/.test(row) && row.trim().split(/\s+/)[1]?.endsWith(`:${port}`));
    const pid = line?.trim().split(/\s+/).pop();
    if (!pid) {
      return "an unknown process";
    }
    const task = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout ?? "";
    const image = task.split(",")[0]?.replace(/"/g, "").trim();
    return `${image || "an unknown process"} (PID ${pid})`;
  }
  const pid = (spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout ?? "").trim().split("\n")[0];
  if (!pid) {
    return "an unknown process";
  }
  const command = (spawnSync("ps", ["-o", "comm=", "-p", pid], { encoding: "utf8" }).stdout ?? "").trim();
  return `${command || "an unknown process"} (PID ${pid})`;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function ensurePortsFree(ports) {
  const busy = [];
  for (const port of ports) {
    if (await isPortOpen(port)) {
      busy.push(`  port ${port} is held by ${portOwner(port)}`);
    }
  }
  if (busy.length > 0) {
    fail(`Refusing to start: these ports must be free.\n${busy.join("\n")}\nStop those processes (often a leftover click-through server) and run again.`);
  }
}

function keepFailedRun(workDir) {
  if (!existsSync(workDir)) {
    return;
  }
  const resultPath = path.join(workDir, RESULT_FILE);
  const previous = existsSync(resultPath) ? readFileSync(resultPath, "utf8").trim() : "crashed";
  if (previous === PASSED) {
    rmSync(workDir, { recursive: true, force: true });
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const keptDir = `${workDir}-${previous}-${stamp}`;
  renameSync(workDir, keptDir);
  console.log(`Kept the previous ${previous} run at ${keptDir}`);
}

function buildApp(distDir, workDir) {
  console.log("> Build the app against the local API");
  const logPath = path.join(workDir, "build.log");
  const log = openSync(logPath, "w");
  const result = spawnSync(process.execPath, [vite, "build", "--outDir", distDir, "--emptyOutDir"], {
    cwd: appDir,
    env: { ...process.env, ...localReverbEnv(), VITE_API_URL: API_URL },
    stdio: ["ignore", log, log],
  });
  closeSync(log);

  const output = readFileSync(logPath, "utf8");
  const moduleCount = output.match(/(\d+) modules transformed/)?.[1] ?? "unknown";
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
  const status = spawnSync("git", ["status", "--porcelain", "--", "app"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
  writeFileSync(
    path.join(workDir, "build-info.txt"),
    [
      `modules transformed: ${moduleCount}`,
      `node: ${process.version}`,
      `NODE_ENV: ${process.env.NODE_ENV ?? "(unset)"}`,
      `git HEAD: ${head}`,
      `git status of app/:`,
      status || "  clean",
      "",
    ].join("\n"),
  );
  console.log(`  ${moduleCount} modules transformed, app/ ${status ? "has uncommitted changes" : "clean"} (details in build-info.txt)`);

  if (result.status !== 0) {
    writeFileSync(path.join(workDir, RESULT_FILE), "failed");
    fail(`Building the app failed with exit code ${result.status}. See ${logPath}`);
  }

  if (MIXED_PATH_SIGNATURE.test(output)) {
    writeFileSync(path.join(workDir, RESULT_FILE), "failed");
    fail(
      `The build resolved app files under two spellings of the same path (usually the drive letter's case), which bundles React twice and crashes every page. See ${logPath}`,
    );
  }
}

function startServer(name, command, args, options, workDir) {
  const logPath = path.join(workDir, `${name}.log`);
  const log = openSync(logPath, "w");
  const child = spawn(command, args, { stdio: ["ignore", log, log], ...options });
  child.on("exit", () => closeSync(log));
  return { name, child, logPath };
}

function stopServer(server) {
  if (!server?.child.pid || server.child.exitCode !== null) {
    return;
  }
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(server.child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.child.kill("SIGTERM");
  }
}

function assertRunning(server) {
  if (server.child.exitCode !== null) {
    throw new StartupError(`The ${server.name} server exited during startup with code ${server.child.exitCode}. See ${server.logPath}`);
  }
}

async function waitUntil(server, ready, description, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    assertRunning(server);
    if (await ready()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new StartupError(`Timed out waiting for ${description}. See ${server.logPath}`);
}

function urlReady(url) {
  return () =>
    fetch(url).then(
      (response) => response.ok,
      () => false,
    );
}

function localReverbEnv() {
  const lines = readFileSync(path.join(appDir, ".env"), "utf8").split(/\r?\n/);
  const entries = lines
    .map((line) => line.match(/^(VITE_REVERB_[A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^"|"$/g, "")]);
  return Object.fromEntries(entries);
}

const suite = process.argv[2];
if (!SUITES.includes(suite)) {
  fail(`Usage: node run.mjs <${SUITES.join("|")}>`);
}

await ensurePortsFree([API_PORT, APP_PORT, REVERB_PORT]);

const workDir = path.join(realpathSync.native(os.tmpdir()), `mcvsync-clickthrough-${suite}`);
keepFailedRun(workDir);
mkdirSync(path.join(workDir, "shots"), { recursive: true });
writeFileSync(path.join(workDir, RESULT_FILE), "crashed");
const database = path.join(workDir, "database.sqlite");
writeFileSync(database, "");
const distDir = path.join(workDir, "dist");
const realtime = REALTIME_SUITES.has(suite);
const apiEnv = {
  ...process.env,
  APP_ENV: "local",
  DB_CONNECTION: "sqlite",
  DB_DATABASE: database,
  SEED_USER_PASSWORD: PASSWORD,
  BROADCAST_CONNECTION: realtime ? "reverb" : "log",
  QUEUE_CONNECTION: "sync",
};

const seedEnv = { ...apiEnv, BROADCAST_CONNECTION: "log" };
runStep("Migrate and seed the click-through database", php, ["artisan", "migrate:fresh", "--seed", "--force"], {
  cwd: apiDir,
  env: seedEnv,
});
runStep(`Seed the ${suite} fixtures`, php, [path.join(scriptDir, "seeds", `${suite}.php`), apiDir], { cwd: apiDir, env: seedEnv });
buildApp(distDir, workDir);

const servers = [
  startServer("api", php, ["artisan", "serve", `--port=${API_PORT}`, "--tries=0"], { cwd: apiDir, env: apiEnv }, workDir),
  startServer("app", process.execPath, [vite, "preview", "--port", String(APP_PORT), "--strictPort", "--outDir", distDir], { cwd: appDir }, workDir),
  ...(realtime
    ? [startServer("reverb", php, ["artisan", "reverb:start", `--port=${REVERB_PORT}`, "--debug"], { cwd: apiDir, env: apiEnv }, workDir)]
    : []),
];
const byName = Object.fromEntries(servers.map((server) => [server.name, server]));

let failed = 1;
try {
  await waitUntil(byName.api, urlReady(`http://localhost:${API_PORT}/up`), `the API on port ${API_PORT}`);
  await waitUntil(byName.app, urlReady(APP_URL), `the app on port ${APP_PORT}`);
  if (realtime) {
    await waitUntil(byName.reverb, () => isPortOpen(REVERB_PORT), `Reverb on port ${REVERB_PORT}`);
  }
  const { run } = await import(`./suites/${suite}.mjs`);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    await run({ browser, shot: screenshotter(path.join(workDir, "shots")) });
  } finally {
    await browser.close();
  }
  failed = finish();
  console.log(`Screenshots: ${path.join(workDir, "shots")}`);
} catch (error) {
  if (!(error instanceof StartupError)) {
    throw error;
  }
  console.error(error.message);
} finally {
  servers.forEach(stopServer);
  writeFileSync(path.join(workDir, RESULT_FILE), failed === 0 ? PASSED : "failed");
  if (failed !== 0) {
    console.log(`Run kept for inspection: ${workDir} (build.log, build-info.txt, server logs)`);
  }
}
process.exit(failed === 0 ? 0 : 1);
