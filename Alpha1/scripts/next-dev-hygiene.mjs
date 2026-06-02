/**
 * Windows-friendly cleanup for stale / partial Next.js output before `next dev`.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stopProjectNextProcesses(projectRoot) {
  if (process.platform !== "win32") return;
  const escaped = projectRoot.replace(/\\/g, "\\\\");
  const ps = [
    "Get-CimInstance Win32_Process",
    "| Where-Object {",
    `$_.CommandLine -and $_.CommandLine -like '*${escaped}*'`,
    "-and ($_.CommandLine -match 'next dev' -or $_.CommandLine -match 'npm run dev' -or $_.CommandLine -match 'next\\\\build' -or $_.CommandLine -match 'dev-clean' -or $_.CommandLine -match 'dev-port' -or $_.CommandLine -match 'node_modules\\\\next\\\\dist\\\\bin\\\\next')",
    "}",
    "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");
  try {
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
  } catch {
    /* none running */
  }
}

export function freePortWindows(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8" });
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
        console.log(`Freed port ${port} (stopped PID ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

export function nextDirPaths(root) {
  return {
    nextDir: path.join(root, ".next"),
    routesManifest: path.join(root, ".next", "routes-manifest.json"),
    cacheDir: path.join(root, "node_modules", ".cache"),
  };
}

/**
 * Detect output that breaks `next dev` (common on Windows when mixing build + dev).
 */
export function isStaleNextForDev(nextDir) {
  if (!fs.existsSync(nextDir)) return false;

  const routesManifest = path.join(nextDir, "routes-manifest.json");
  const serverDir = path.join(nextDir, "server");
  const hasServer = fs.existsSync(serverDir);
  const hasManifest = fs.existsSync(routesManifest);

  // `next build` artifacts must not be reused by `next dev`
  if (fs.existsSync(path.join(nextDir, "BUILD_ID"))) return true;
  if (fs.existsSync(path.join(nextDir, "export-marker.json"))) return true;

  // Crashed dev compile: server chunks without manifest
  if (hasServer && !hasManifest) return true;

  if (!hasManifest) return false;

  try {
    JSON.parse(fs.readFileSync(routesManifest, "utf8"));
  } catch {
    return true;
  }

  return false;
}

export async function removeDirWithRetry(dir, label = dir) {
  const opts = { recursive: true, force: true, maxRetries: 8, retryDelay: 250 };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, opts);
      }
      if (!fs.existsSync(dir)) return true;
    } catch (err) {
      if (attempt >= 7) {
        console.warn(`Could not fully remove ${label}: ${err instanceof Error ? err.message : err}`);
        return false;
      }
      await sleep(400);
    }
  }
  return !fs.existsSync(dir);
}

/** Drop partial dev output that causes routes-manifest / chunk ENOENT on Windows. */
export async function ensureCleanNextForDev(root, { log = true } = {}) {
  const { nextDir, cacheDir } = nextDirPaths(root);
  const incomplete = isStaleNextForDev(nextDir);

  if (incomplete) {
    if (log) {
      console.warn(
        "Detected stale or incomplete .next (common after dev:clean or interrupted compile). Removing…",
      );
    }
    stopProjectNextProcesses(root);
    await sleep(300);
    await removeDirWithRetry(nextDir, ".next");
    if (fs.existsSync(cacheDir)) {
      await removeDirWithRetry(cacheDir, "node_modules/.cache");
    }
    await sleep(200);
    return true;
  }

  return false;
}
