/**
 * Starts Next dev on a configurable port (default 3002).
 * Usage: npm run dev
 *        npm run dev -- 3003
 *        node scripts/dev-port.mjs 3000
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const fromArg = process.argv[2];
const fromEnv = process.env.DEV_PORT || process.env.PORT;
const port = String(fromArg || fromEnv || "3002").trim() || "3002";

const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: port },
});

child.on("exit", (code) => process.exit(code ?? 0));
