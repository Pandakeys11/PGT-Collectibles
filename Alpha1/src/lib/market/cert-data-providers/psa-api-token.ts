/** Shared PSA Public API auth (portal token, API key, or OAuth password grant). */

let cachedToken: { value: string; expiresAt: number } | null = null;

function cleanEnv(key: string): string | null {
  const raw = process.env[key]?.trim();
  if (!raw || /^(your_|replace|paste|<)/i.test(raw)) return null;
  return raw.replace(/^["']|["']$/g, "");
}

export function psaPublicApiConfigured(): boolean {
  if (cleanEnv("PSA_API_ACCESS_TOKEN")) return true;
  if (cleanEnv("PSA_API_KEY")) return true;
  return Boolean(
    cleanEnv("PSA_API_CLIENT_ID") &&
      cleanEnv("PSA_API_CLIENT_SECRET") &&
      cleanEnv("PSA_API_USERNAME") &&
      cleanEnv("PSA_API_PASSWORD"),
  );
}

export async function getPsaPublicApiAccessToken(): Promise<string | null> {
  const manual = cleanEnv("PSA_API_ACCESS_TOKEN") ?? cleanEnv("PSA_API_KEY");
  if (manual) return manual;

  if (!psaPublicApiOAuthConfigured()) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const tokenUrl =
    process.env.PSA_API_TOKEN_URL?.trim() ||
    "https://api.psacard.com/publicapi/oauth/token";

  const body = new URLSearchParams({
    grant_type: "password",
    username: cleanEnv("PSA_API_USERNAME")!,
    password: cleanEnv("PSA_API_PASSWORD")!,
    client_id: cleanEnv("PSA_API_CLIENT_ID")!,
    client_secret: cleanEnv("PSA_API_CLIENT_SECRET")!,
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

function psaPublicApiOAuthConfigured(): boolean {
  return Boolean(
    cleanEnv("PSA_API_CLIENT_ID") &&
      cleanEnv("PSA_API_CLIENT_SECRET") &&
      cleanEnv("PSA_API_USERNAME") &&
      cleanEnv("PSA_API_PASSWORD"),
  );
}
