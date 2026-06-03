/**
 * Check whether a deployed host has eBay Browse OAuth configured.
 * Usage: node scripts/check-ebay-browse-deploy.mjs
 *        node scripts/check-ebay-browse-deploy.mjs https://pgtscan.tech
 */
const base = (process.argv[2] ?? "https://pgtscan.tech").replace(/\/$/, "");

async function main() {
  const endingUrl = `${base}/api/market/ebay-ending-soon?refresh=1`;
  const statusUrl = `${base}/api/market/ebay-status`;

  console.log(`Checking eBay Browse on ${base} …\n`);

  try {
    const statusRes = await fetch(statusUrl, { signal: AbortSignal.timeout(15_000) });
    if (statusRes.ok) {
      const status = await statusRes.json();
      console.log("ebay-status:", JSON.stringify(status, null, 2));
      if (status.configured) {
        console.log("\n✓ Server reports eBay Browse credentials present.");
        return;
      }
    } else {
      console.log(`ebay-status: HTTP ${statusRes.status} (route may not be deployed yet)`);
    }
  } catch (e) {
    console.log("ebay-status: unavailable —", e instanceof Error ? e.message : e);
  }

  const res = await fetch(endingUrl, { signal: AbortSignal.timeout(20_000) });
  const body = await res.json();
  console.log("\nebay-ending-soon:", {
    http: res.status,
    ready: body.ready,
    error: body.error ?? null,
    listings: body.listings?.length ?? 0,
  });

  if (body.ready) {
    console.log("\n✓ Live auctions feed is working.");
    return;
  }

  console.log(`
✗ eBay ending soon is not ready on this host.

This is NOT an API credit limit — Browse uses OAuth (EBAY_CLIENT_ID + EBAY_CLIENT_SECRET).

Fix for Vercel / production:
  1. Vercel → your project → Settings → Environment Variables
  2. Add for Production: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_API_ENV=production
  3. Redeploy

Local dev: copy values from Alpha1/.env.local and restart npm run dev:clean
`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
