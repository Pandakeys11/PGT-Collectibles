/** Shared PSA Public API OAuth token (used by psa_public + optional Apify actor input). */

let cachedToken: { value: string; expiresAt: number } | null = null;

export function psaPublicApiConfigured(): boolean {
  return Boolean(
    process.env.PSA_API_CLIENT_ID?.trim() &&
      process.env.PSA_API_CLIENT_SECRET?.trim() &&
      process.env.PSA_API_USERNAME?.trim() &&
      process.env.PSA_API_PASSWORD?.trim(),
  );
}

export async function getPsaPublicApiAccessToken(): Promise<string | null> {
  const manual = process.env.PSA_API_ACCESS_TOKEN?.trim();
  if (manual) return manual;

  if (!psaPublicApiConfigured()) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const tokenUrl =
    process.env.PSA_API_TOKEN_URL?.trim() ||
    "https://api.psacard.com/publicapi/oauth/token";

  const body = new URLSearchParams({
    grant_type: "password",
    username: process.env.PSA_API_USERNAME!.trim(),
    password: process.env.PSA_API_PASSWORD!.trim(),
    client_id: process.env.PSA_API_CLIENT_ID!.trim(),
    client_secret: process.env.PSA_API_CLIENT_SECRET!.trim(),
  });

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  } catch {
    return null;
  }
}
