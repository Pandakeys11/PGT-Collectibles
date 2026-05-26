/**
 * Stop dev servers, ngrok, and remove .next build output.
 * Usage: npm run kill:all
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";
import { resolveDevPort } from "./ngrok-clerk-hint.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnvLocal();
const devPort = resolveDevPort([]);

const PORTS = [devPort, 3000, 3002, 3003, 4040];

function freePortWindows(p) {
  try {
    const out = execSync(`netstat -ano | findstr ":${p}"`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Freed port ${p} (PID ${pid})`);
      } catch {
        /* gone */
      }
    }
  } catch {
    /* nothing on port */
  }
}

function killProjectNodeProcesses() {
  if (process.platform !== "win32") return;
  const scriptPath = path.join(root, "scripts", ".kill-project-node.ps1");
  const ps1 = `
$root = ${JSON.stringify(root)}
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return }
  if ($cmd -like "*PGT_Vision*" -or $cmd -like "*Alpha1*next*" -or $cmd -like "*ngrok*") {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Output $_.ProcessId
  }
}
`.trim();
  try {
    fs.writeFileSync(scriptPath, ps1, "utf8");
    const out = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { encoding: "utf8" },
    ).trim();
    fs.unlinkSync(scriptPath);
    if (out) {
      for (const pid of out.split(/\r?\n/).filter(Boolean)) {
        console.log(`Stopped node PID ${pid} (project/ngrok)`);
      }
    }
  } catch {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* */
    }
  }
}

console.log("Stopping servers and cleaning build output…\n");

if (process.platform === "win32") {
  for (const p of PORTS) freePortWindows(p);
  killProjectNodeProcesses();
} else {
  for (const p of PORTS) {
    try {
      execSync(`lsof -ti :${p} | xargs kill -9 2>/dev/null`, { stdio: "ignore" });
      console.log(`Freed port ${p}`);
    } catch {
      /* */
    }
  }
}

const nextDir = path.join(root, ".next");
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("Removed .next");
}

console.log("\nDone. Start fresh with: npm run dev:clean");
