/**
 * Runs Next dev + ngrok tunnel in one terminal.
 * Usage: npm run dev:tunnel
 *        npm run dev:tunnel -- 3003
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";
import { logEbayBrowseEnvHint } from "./log-ebay-browse-env.mjs";
import { ensureCleanNextForDev } from "./next-dev-hygiene.mjs";
import {
  fetchNgrokPublicUrl,
  printClerkWebhookHint,
  resolveDevPort,
} from "./ngrok-clerk-hint.mjs";
import { resolveNgrokExecutable } from "./resolve-ngrok.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnvLocal();

const port = resolveDevPort(process.argv);
const ngrokBin = resolveNgrokExecutable();
const children = [];

if (!process.env.NGROK_AUTHTOKEN?.trim()) {
  console.warn(
    "Warning: NGROK_AUTHTOKEN is missing in .env.local — run npm run ngrok:setup after adding your token.\n",
  );
}

function prefixStream(stream, label, out) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) out.write(`[${label}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) out.write(`[${label}] ${buffer}\n`);
  });
}

await ensureCleanNextForDev(root);

logEbayBrowseEnvHint();
console.log(`Starting Next.js on http://localhost:${port} + ngrok tunnel…`);
console.log(
  "If you see errors like Cannot find module './5745.js', stop the server and run: npm run dev:clean\n",
);

const next = spawn("npx", ["next", "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: port },
});

const ngrok = spawn(ngrokBin, ["http", port], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

children.push(next, ngrok);

prefixStream(ngrok.stdout, "ngrok", process.stdout);
prefixStream(ngrok.stderr, "ngrok", process.stderr);

void fetchNgrokPublicUrl().then((url) => {
  if (url) printClerkWebhookHint(url);
});

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

let exiting = false;
function onChildExit(label, code) {
  if (exiting) return;
  exiting = true;
  if (code && code !== 0) {
    console.error(`\n[${label}] exited with code ${code}`);
  }
  shutdown("SIGTERM");
  setTimeout(() => shutdown("SIGKILL"), 2000);
  process.exit(code ?? 0);
}

next.on("exit", (code) => onChildExit("next", code));
ngrok.on("exit", (code) => onChildExit("ngrok", code));

process.on("SIGINT", () => {
  exiting = true;
  shutdown("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  exiting = true;
  shutdown("SIGTERM");
  process.exit(0);
});
