import {
  getGeminiApiKey,
  getGeminiEmbeddingDimensions,
  getGeminiEmbeddingModel,
  isArtMatchEnabled,
} from "@/lib/ai/env";

export type ArtEmbeddingTask = "query" | "document";

const ALLOWED_IMAGE_HOSTS = new Set([
  "images.pokemontcg.io",
  "images.scrydex.com",
  "images.pokemoncard.io",
  "product-images.tcgplayer.com",
  "tcgplayer-cdn.tcgplayer.com",
  "assets.tcgdex.net",
  "assets.pokemon.com",
  "cards.scryfall.io",
  "images.ygoprodeck.com",
]);

function hostAllowed(hostname: string): boolean {
  if (ALLOWED_IMAGE_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".supabase.co")) return true;
  if (hostname.endsWith(".supabase.in")) return true;
  return false;
}

export function parseArtMatchImageFromDataUrl(
  dataUrl: string | null | undefined,
): { base64: string; mimeType: string } | null {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1).trim();
  if (!base64) return null;
  const mimeType = dataUrl.match(/^data:([^;]+)/)?.[1]?.trim() ?? "image/jpeg";
  return { base64, mimeType };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function fetchCatalogImageBase64(
  imageUrl: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) {
    return parseArtMatchImageFromDataUrl(trimmed);
  }

  let target: URL;
  try {
    target = new URL(trimmed);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) return null;

  try {
    const res = await fetch(target.toString(), {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 6 * 1024 * 1024) return null;
    return {
      base64: Buffer.from(buf).toString("base64"),
      mimeType,
    };
  } catch {
    return null;
  }
}

function buildEmbedParts(args: {
  base64: string;
  mimeType: string;
  textLabel?: string | null;
}): Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> {
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
  const label = args.textLabel?.trim();
  if (label) parts.push({ text: label });
  parts.push({
    inline_data: {
      mime_type: args.mimeType,
      data: args.base64,
    },
  });
  return parts;
}

export async function embedArtImage(args: {
  base64: string;
  mimeType: string;
  task: ArtEmbeddingTask;
  /** Card identity hint — required for gemini-embedding-001; improves embedding-2 quality. */
  textLabel?: string | null;
}): Promise<number[] | null> {
  if (!isArtMatchEnabled()) return null;
  const key = getGeminiApiKey();
  if (!key) return null;

  const model = getGeminiEmbeddingModel();
  const dimensions = getGeminiEmbeddingDimensions();
  const taskType = args.task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: buildEmbedParts(args),
          },
          taskType,
          outputDimensionality: dimensions,
        }),
        signal: AbortSignal.timeout(18_000),
      },
    );

    const data = (await res.json().catch(() => ({}))) as {
      embedding?: { values?: number[] };
      error?: { message?: string };
    };
    if (!res.ok) return null;
    const values = data.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) return null;
    return values;
  } catch {
    return null;
  }
}

export function artMatchModelId(): string {
  return getGeminiEmbeddingModel();
}

export function artMatchDimensions(): number {
  return getGeminiEmbeddingDimensions();
}
