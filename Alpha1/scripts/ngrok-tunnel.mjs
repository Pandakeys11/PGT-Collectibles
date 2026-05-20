/**
 * Exposes local Next dev (DEV_PORT / 3002) via ngrok and prints Clerk webhook URL.
 * Prereq: npm run ngrok:setup (once, after NGROK_AUTHTOKEN in .env.local)
 */
import { spawn } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fetchNgrokPublicUrl,
  printClerkWebhookHint,
  resolveDevPort,
} from "./ngrok-clerk-hint.mjs";
import { resolveNgrokExecutable } from "./resolve-ngrok.mjs";

loadEnvLocal();

const ngrokBin = resolveNgrokExecutable();
const port = resolveDevPort(process.argv);

console.log(`Starting ngrok → http://localhost:${port} …`);
console.log("(Pair with npm run dev, or use npm run dev:tunnel for both.)\n");

const child = spawn(ngrokBin, ["http", port], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
child.stderr?.on("data", (chunk) => process.stdout.write(chunk));

void fetchNgrokPublicUrl().then((url) => {
  if (url) printClerkWebhookHint(url);
  else {
    console.log(
      "Tunnel started. Open http://127.0.0.1:4040 for the public URL, then set Clerk webhook to:\n  https://YOUR-NGROK-HOST/api/webhooks/clerk\n",
    );
  }
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => {
  child.kill("SIGINT");
});
