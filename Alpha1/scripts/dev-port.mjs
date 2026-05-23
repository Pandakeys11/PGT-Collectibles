/**
 * Starts Next dev on a configurable port (default 3002).
 * Usage: npm run dev
 *        npm run dev -- 3003
 *        node scripts/dev-port.mjs 3000
 */
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const fromArg = process.argv[2];
const fromEnv = process.env.DEV_PORT || process.env.PORT;
const port = String(fromArg || fromEnv || "3002").trim() || "3002";

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

const owner = portOwnerCommandLine(port);
if (owner?.cmd) {
  const normalizedRoot = root.replace(/\\/g, "/").toLowerCase();
  const normalizedCmd = owner.cmd.replace(/\\/g, "/").toLowerCase();
  const isThisProject = normalizedCmd.includes(normalizedRoot);
  if (!isThisProject) {
    console.error(
      `\nPort ${port} is already used by another app (PID ${owner.pid}):\n  ${owner.cmd}\n`,
    );
    console.error(
      `This repo is:\n  ${root}\n\nStop that process, or run:\n  npm run dev -- 3003\n`,
    );
    process.exit(1);
  }
}

const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: port },
});

child.on("exit", (code) => process.exit(code ?? 0));
