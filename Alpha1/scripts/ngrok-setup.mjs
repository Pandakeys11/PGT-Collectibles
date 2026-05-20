/**
 * Registers ngrok authtoken from NGROK_AUTHTOKEN in .env.local
 * Get token: https://dashboard.ngrok.com/get-started/your-authtoken
 */
import { spawnSync } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";
import { resolveNgrokExecutable } from "./resolve-ngrok.mjs";

loadEnvLocal();

const ngrokBin = resolveNgrokExecutable();

const token = process.env.NGROK_AUTHTOKEN?.trim();
if (!token) {
  console.error(`
NGROK_AUTHTOKEN is missing.

1. Sign in at https://dashboard.ngrok.com/
2. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
3. Add to .env.local:

   NGROK_AUTHTOKEN=your_token_here

4. Run again: npm run ngrok:setup
`);
  process.exit(1);
}

const result = spawnSync(ngrokBin, ["config", "add-authtoken", token], {
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  console.error(
    "\nngrok CLI not found. Restart your terminal after install, or run: winget install Ngrok.Ngrok",
  );
  process.exit(result.status ?? 1);
}

console.log("\nngrok authtoken saved. Start tunnel with: npm run tunnel");
