/**
 * Verify live Clerk auth wiring (production smoke).
 * Usage: node scripts/verify-clerk-live.mjs [baseUrl]
 *
 * Checks:
 * - Clerk JS URL from HTML returns 200 (custom domain DNS must point to Clerk, not Vercel)
 * - Baked ClerkProvider env matches expected paths
 */
const baseUrl = (process.argv[2] ?? "https://pgtscan.tech").replace(/\/$/, "");

const EXPECT = {
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  signInFallbackRedirectUrl: "/liquid-scan",
  signUpFallbackRedirectUrl: "/liquid-scan",
};

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`);
}

async function main() {
  console.log(`\nClerk live check — ${baseUrl}/sign-in\n`);

  let html;
  try {
    const res = await fetch(`${baseUrl}/sign-in`, { redirect: "follow" });
    html = await res.text();
    if (!res.ok) fail(`sign-in page HTTP ${res.status}`);
    else pass(`sign-in page HTTP ${res.status}`);
  } catch (e) {
    fail(`fetch sign-in failed — ${e.message}`);
    return;
  }

  const jsMatch = html.match(
    /src="(https:\/\/[^"]+\/npm\/@clerk\/clerk-js[^"]+)"/,
  );
  if (!jsMatch) {
    fail("Clerk JS script tag not found in HTML");
  } else {
    const jsUrl = jsMatch[1];
    pass(`Clerk JS URL — ${jsUrl}`);
    try {
      const jsRes = await fetch(jsUrl, { method: "HEAD", redirect: "follow" });
      if (jsRes.ok) pass(`Clerk JS reachable — HTTP ${jsRes.status}`);
      else {
        fail(
          `Clerk JS HTTP ${jsRes.status} — custom domain DNS likely wrong (must CNAME to Clerk, not Vercel)`,
        );
      }
    } catch (e) {
      fail(`Clerk JS fetch failed — ${e.message}`);
    }
  }

  const providerMatch = html.match(/\\"signInUrl\\":\\"([^\\"]*)\\"/);
  const baked = {
    signInUrl: providerMatch?.[1],
    signUpUrl: html.match(/\\"signUpUrl\\":\\"([^\\"]*)\\"/)?.[1],
    signInFallbackRedirectUrl: html.match(
      /\\"signInFallbackRedirectUrl\\":\\"([^\\"]*)\\"/,
    )?.[1],
    signUpFallbackRedirectUrl: html.match(
      /\\"signUpFallbackRedirectUrl\\":\\"([^\\"]*)\\"/,
    )?.[1],
  };

  for (const [key, expected] of Object.entries(EXPECT)) {
    const actual = baked[key];
    if (actual === expected) pass(`${key} = ${actual}`);
    else if (actual == null) warn(`${key} not found in HTML payload`);
    else
      fail(
        `${key} = ${actual} (expected ${expected}) — fix Vercel env and redeploy`,
      );
  }

  if (baked.signUpUrl === "/scanner") {
    fail("signUpUrl still /scanner — legacy path; use /sign-up");
  }
  if (baked.signInUrl === "/sign-up") {
    fail("signInUrl is /sign-up — swapped with sign-up URL in Vercel");
  }

  console.log("");
  if (process.exitCode) {
    console.log(
      "Fix: Clerk Dashboard → Domains → add DNS CNAMEs (not Vercel). Then correct Vercel Clerk env vars and redeploy.\n",
    );
  } else {
    console.log("Clerk live wiring looks OK.\n");
  }
}

main();
