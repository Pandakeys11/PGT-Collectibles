/**
 * Starts Next dev on a configurable port (default 3002).
 * Usage: npm run dev
 *        npm run dev -- 3003
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCleanNextForDev } from "./next-dev-hygiene.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const fromArg = process.argv[2];
const fromEnv = process.env.DEV_PORT || process.env.PORT;
const port = String(fromArg || fromEnv || "3002").trim() || "3002";

await ensureCleanNextForDev(root);

console.log(
  "Tip: if pages 500 with missing routes-manifest or chunk files, stop the server and run: npm run dev:clean\n",
);

const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: port },
});

child.on("exit", (code) => process.exit(code ?? 0));
