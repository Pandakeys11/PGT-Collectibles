/**
 * Free DEV_PORT, remove .next, start Next dev.
 * Usage: npm run dev:clean
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";
import { logEbayBrowseEnvHint } from "./log-ebay-browse-env.mjs";
import { resolveDevPort } from "./ngrok-clerk-hint.mjs";
import {
  ensureCleanNextForDev,
  freePortWindows,
  removeDirWithRetry,
  sleep,
  stopProjectNextProcesses,
} from "./next-dev-hygiene.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnvLocal();
const port = resolveDevPort(process.argv);

function portOwnerCommandLine(p) {
  if (process.platform !== "win32") return null;
  try {
    const out = execSync(`netstat -ano | findstr ":${p}"`, { encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (!(pid > 0)) continue;
      try {
        const cmd = execSync(
          `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
          { encoding: "utf8" },
        ).trim();
        return { pid, cmd };
      } catch {
        return { pid, cmd: null };
      }
    }
  } catch {
    /* nothing listening */
  }
  return null;
}

console.log(`Cleaning dev environment (port ${port})…`);
const before = portOwnerCommandLine(port);
if (before?.cmd) {
  const normalizedRoot = root.replace(/\\/g, "/").toLowerCase();
  const normalizedCmd = before.cmd.replace(/\\/g, "/").toLowerCase();
  if (!normalizedCmd.includes(normalizedRoot)) {
    console.warn(
      `Warning: port ${port} was used by another project (PID ${before.pid}):\n  ${before.cmd}\n`,
    );
  }
}

stopProjectNextProcesses(root);
if (process.platform === "win32") freePortWindows(port);
await sleep(500);

const nextDir = path.join(root, ".next");
const cacheDir = path.join(root, "node_modules", ".cache");
await removeDirWithRetry(nextDir, ".next");
if (fs.existsSync(cacheDir)) {
  await removeDirWithRetry(cacheDir, "node_modules/.cache");
}
console.log("Removed .next");

await sleep(400);
await ensureCleanNextForDev(root, { log: false });

logEbayBrowseEnvHint();
console.log(`Starting Next.js on http://localhost:${port} …`);
console.log("Wait for “Ready”, then open the app (first compile can take ~10s).\n");

const child = spawn("npx", ["next", "dev", "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(port) },
});

child.on("exit", (code) => process.exit(code ?? 0));
