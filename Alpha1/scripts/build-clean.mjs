/**
 * Production build with a clean .next (avoids mixing dev + build artifacts on Windows).
 * Usage: npm run build
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeDirWithRetry, sleep, stopProjectNextProcesses } from "./next-dev-hygiene.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const nextDir = path.join(root, ".next");
console.log("Preparing production build…");
console.log("Stopping local Next dev processes (stop npm run dev if build still fails)…");
stopProjectNextProcesses(root);
await sleep(1200);
if (await removeDirWithRetry(nextDir, ".next")) {
  console.log("Removed .next");
}

execSync("npx next build", { cwd: root, stdio: "inherit", shell: true });
