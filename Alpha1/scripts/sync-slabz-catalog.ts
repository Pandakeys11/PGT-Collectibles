/**
 * Sync Slabz packs + slabs via the Next.js API route (avoids server-only imports).
 *
 *   npx tsx --env-file=.env.local scripts/sync-slabz-catalog.ts
 *   npx tsx --env-file=.env.local scripts/sync-slabz-catalog.ts --max=200
 *
 * Requires dev server: npm run dev (default port 3002)
 */
const maxArg = process.argv.find((a) => a.startsWith("--max="));
const maxTransactions = maxArg ? Number(maxArg.split("=")[1]) : 500;

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();

async function main() {
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const url = `${appUrl}/api/partners/slabz/sync?maxTransactions=${maxTransactions}${
    secret ? "" : ""
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
  });

  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) {
    if (res.status === 401) {
      console.error(
        "\nTip: set CRON_SECRET in .env.local and restart dev, or sign in and use the UI Sync button.",
      );
    }
    process.exit(1);
  }
  process.exit(body.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
