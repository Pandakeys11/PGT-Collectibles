export function resolveDevPort(argv = []) {
  const fromArg = argv[2];
  const fromEnv = process.env.DEV_PORT || process.env.PORT;
  return String(fromArg || fromEnv || "3002").trim() || "3002";
}

export async function fetchNgrokPublicUrl(retries = 16) {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (!res.ok) continue;
      const body = await res.json();
      const tunnels = body.tunnels ?? [];
      const https = tunnels.find((t) => t.public_url?.startsWith("https://"));
      if (https?.public_url) return https.public_url;
    } catch {
      /* ngrok API not up yet */
    }
  }
  return null;
}

export function printClerkWebhookHint(publicBase) {
  const webhook = `${publicBase}/api/webhooks/clerk`;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Clerk webhook (local via ngrok)

  Endpoint URL (paste in Clerk Dashboard → Webhooks → Add endpoint):

    ${webhook}

  Events: user.created · user.updated · user.deleted

  Then set in .env.local:  CLERK_WEBHOOK_SECRET=whsec_…
  Inspector: http://127.0.0.1:4040
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}
