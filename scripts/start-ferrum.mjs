import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = join(root, "frontend");
const next = join(frontend, "node_modules", "next", "dist", "bin", "next");
const python = join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const apiOrigin = "http://127.0.0.1:8000";
const children = new Set();
let stopping = false;

function options(args) {
  let dev = false, port = Number(process.env.FERRUM_PORT ?? 3000), explicitPort = Boolean(process.env.FERRUM_PORT);
  let open = false, mobile = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--dev") dev = true;
    else if (arg === "--mobile") mobile = true;
    else if (arg === "--open") open = true;
    else if (arg === "--port" || arg === "-p") { port = Number(args[++index]); explicitPort = true; }
    else if (arg === "--hostname" || arg === "-H") {
      const host = args[++index];
      if (!["127.0.0.1", "localhost", "0.0.0.0"].includes(host)) throw new Error("Use a local hostname: 127.0.0.1 or localhost.");
    } else if (arg === "--help" || arg === "-h") return { help: true };
    else throw new Error(`Unknown option: ${arg}. Supported options: --dev, --mobile, --open, --port <number>.`);
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8000) throw new Error("Choose a frontend port between 1024 and 65535, excluding the API port 8000.");
  return { dev, port, explicitPort, open, mobile };
}

function phoneHost() {
  const adapters = Object.entries(networkInterfaces())
    .sort(([a], [b]) => Number(/^(wi-?fi|wlan)/i.test(b)) - Number(/^(wi-?fi|wlan)/i.test(a)));
  for (const [, addresses] of adapters) {
    const local = addresses?.find(({ internal, family, address }) =>
      !internal && family === "IPv4" && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
    if (local) return local.address;
  }
  throw new Error("Connect this computer to your private Wi-Fi or Ethernet network, then start Ferrum Mobile again.");
}

async function openBrowser(origin) {
  const candidates = [];
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      const brave = join(base, "BraveSoftware", "Brave-Browser", "Application", "brave.exe");
      if (existsSync(brave)) candidates.push([brave, [origin]]);
    }
    candidates.push(["rundll32.exe", ["url.dll,FileProtocolHandler", origin]]);
  } else {
    candidates.push([process.platform === "darwin" ? "open" : "xdg-open", [origin]]);
  }
  for (const [command, args] of candidates) {
    const opened = await new Promise(resolveOpen => {
      const browser = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
      browser.once("error", () => resolveOpen(false));
      browser.once("spawn", () => { browser.unref(); resolveOpen(true); });
    });
    if (opened) return;
  }
  console.error("Open the address above in your browser.");
}

async function json(url, timeout = 2500) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

async function portAvailable(port, host = "127.0.0.1") {
  return new Promise(resolvePort => {
    const server = createServer();
    server.once("error", () => resolvePort(false));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolvePort(true)));
  });
}

async function isFerrumFrontend(origin, mode, revision) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(4000) });
    const matches = response.ok && response.headers.get("x-ferrum-mode") === mode
      && (!revision || response.headers.get("x-ferrum-revision") === revision);
    if (!matches) {
      await response.body?.cancel();
      return false;
    }
    if (!/<title>Ferrum/.test(await response.text())) return false;
    const data = await json(`${origin}/api/v1/companies`, 15000);
    return Array.isArray(data?.companies) && data.count > 0 && data.companies.length === data.count && Boolean(data.companies[0]?.ID);
  } catch { return false; }
}

function start(label, binary, args, cwd = root, settings = {}) {
  console.log(`[${label}] Starting...`);
  const child = spawn(binary, args, {
    cwd, windowsHide: true, detached: process.platform !== "win32",
    env: { ...process.env, FERRUM_API_ORIGIN: apiOrigin, ...settings },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  child.stdout.on("data", chunk => process.stdout.write(chunk));
  child.stderr.on("data", chunk => process.stderr.write(chunk));
  child.once("error", error => { child.launchError = error; });
  child.once("exit", (code, signal) => {
    if (!stopping && child.serviceReady) {
      console.error(`[${label}] Stopped unexpectedly (${signal ?? code}). Restart Ferrum with Start-Ferrum.cmd.`);
      void shutdown(1);
    }
  });
  return child;
}

async function waitFor(label, check, child, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (stopping) throw new Error("Startup cancelled.");
    if (child?.launchError) throw new Error(`${label} could not start: ${child.launchError.message}`);
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error(`${label} exited before it was ready. See the error above.`);
    if (await check()) return;
    await new Promise(resolveDelay => setTimeout(resolveDelay, 400));
  }
  throw new Error(`${label} did not become ready. Check the messages above and ensure ports 8000 and the printed frontend port are available.`);
}

function webRevision() {
  const hash = createHash("sha256");
  function add(relative) {
    const path = join(frontend, relative);
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) add(`${relative}/${name}`);
      return;
    }
    const contents = readFileSync(path);
    hash.update(`${relative}\0${contents.length}\0`).update(contents);
  }
  for (const input of [
    "src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json",
    ".env", ".env.local", ".env.production", ".env.production.local",
  ]) add(input);
  return hash.digest("hex");
}

async function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise(resolveStop => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", resolveStop); killer.once("exit", resolveStop);
    });
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* The owned process may already have stopped. */ }
  }
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children].map(stop));
  console.log("\nFerrum stopped.");
  process.exit(code);
}

async function main() {
  const config = options(process.argv.slice(2));
  if (config.help) {
    console.log("Start Ferrum: node scripts/start-ferrum.mjs [--dev] [--mobile] [--open] [--port 3000]\nStarts the API and frontend together. Use --mobile for a private network address. Use --open to open the website in your browser.");
    return;
  }
  if (!existsSync(python)) throw new Error("The project Python environment is missing. Create .venv and install backend/requirements.txt first.");
  if (!existsSync(next)) throw new Error("Frontend dependencies are missing. Run npm.cmd install from the frontend folder, then start Ferrum again.");

  const host = config.mobile ? phoneHost() : "127.0.0.1";
  const health = await json(`${apiOrigin}/health`);
  let api;
  if (health?.application === "Ferrum" && health.status === "ok") console.log("[API] Reusing the running Ferrum research service.");
  else {
    if (!await portAvailable(8000)) throw new Error("Port 8000 is occupied by another service. Stop that service before starting Ferrum; no unrelated process was stopped.");
    api = start("API", python, ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"]);
    await waitFor("Research API", async () => (await json(`${apiOrigin}/health`))?.application === "Ferrum", api);
    api.serviceReady = true;
  }

  console.log("[API] Preparing company research...");
  await waitFor("Company research data", async () => {
    const data = await json(`${apiOrigin}/api/v1/companies`, 15000);
    return Array.isArray(data?.companies) && data.count > 0 && data.companies.length === data.count;
  }, api);

  console.log("[API] Preparing source workbooks...");
  await waitFor("Source workbook inventory", async () => {
    const data = await json(`${apiOrigin}/api/v1/sources`, 120000);
    return Array.isArray(data?.sources) && data.sources.length > 0 && Array.isArray(data.references);
  }, api);

  const mode = config.dev ? "development" : "production";
  const revision = config.dev ? null : webRevision();
  const limit = config.explicitPort ? config.port : Math.min(65535, config.port + 10);
  let availablePort, currentPort;
  for (let candidate = config.port; candidate <= limit; candidate++) {
    if (candidate === 8000) continue;
    if (await portAvailable(candidate, "0.0.0.0")) {
      availablePort ??= candidate;
    } else if (await isFerrumFrontend(`http://${host}:${candidate}`, mode, revision)) {
      currentPort = candidate;
      break;
    }
  }
  const port = currentPort ?? availablePort;
  if (!port) {
    throw new Error(config.explicitPort
      ? `Port ${config.port} is occupied. Use a different port or launch without --port to open the current version.`
      : "No available frontend port was found. Close an older Ferrum window or specify a free port.");
  }
  const origin = `http://${host}:${port}`;
  if (port !== config.port) console.log(`[Web] Using port ${port} for the current Ferrum website.`);

  if (currentPort) console.log("[Web] Reusing the current Ferrum website.");
  else {
    const environment = {
      FERRUM_PRODUCTION_PORT: revision ? String(port) : "",
      FERRUM_WEB_REVISION: revision ?? "",
    };
    if (revision) {
      // A live server can continue serving files from its own output directory.
      const cache = join(frontend, ".next");
      const output = join(cache, `ferrum-${port}`);
      const marker = join(output, "ferrum-revision");
      if (!existsSync(join(output, "BUILD_ID")) || !existsSync(marker) || readFileSync(marker, "utf8") !== revision) {
        mkdirSync(cache, { recursive: true });
        writeFileSync(join(cache, "tsconfig.ferrum.json"), JSON.stringify({
          extends: "../tsconfig.json",
          include: ["../next-env.d.ts", "../src/**/*.ts", "../src/**/*.tsx", "../src/**/*.mts", "../next.config.ts"],
        }));
        const build = start("Build", process.execPath, [next, "build"], frontend, environment);
        const code = await new Promise((resolveBuild, rejectBuild) => { build.once("exit", resolveBuild); build.once("error", rejectBuild); });
        if (code !== 0) throw new Error("The frontend build failed. See the error above.");
        children.delete(build);
        if (webRevision() !== revision) throw new Error("Frontend files changed while building. Run Start-Ferrum.cmd again.");
        writeFileSync(marker, revision);
      }
    }
    const web = start("Web", process.execPath, [next, config.dev ? "dev" : "start", "--hostname", host, "--port", String(port)], frontend, environment);
    await waitFor("Website and research data", () => isFerrumFrontend(origin, mode, revision), web);
    web.serviceReady = true;
  }

  console.log(`\nFerrum is ready:\n\n  ${origin}\n`);
  if (config.mobile) console.log("Open the address above on your phone while connected to the same Wi-Fi.");
  if (config.open) await openBrowser(origin);
  if (children.size) {
    console.log("Keep this terminal open while using the website. Press Ctrl+C to stop.");
    await new Promise(() => {});
  } else {
    console.log("Ferrum is already running. You can close this window and keep using the website.");
    if (config.open && process.stdin.isTTY) {
      const terminal = createInterface({ input: process.stdin, output: process.stdout });
      try { await terminal.question("Press Enter to close this window. "); }
      finally { terminal.close(); }
    }
  }
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
main().catch(async error => {
  if (!stopping) console.error(`\nFerrum startup failed: ${error.message}`);
  await shutdown(1);
});
