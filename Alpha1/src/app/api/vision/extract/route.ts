import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getVisionProviderTimeoutMs,
  getVisionSkipProviders,
} from "@/lib/ai/env";
import { isMasterAdminEmail } from "@/lib/auth/admin";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { consumeScanCredits } from "@/lib/auth/usage";
import { buildVisionPrompt } from "@/lib/ai/vision-prompts";
import {
  formatVisionProviderError,
  listEnabledVisionProviders,
  noteProviderFailure,
  runVisionProviderOnce,
} from "@/lib/ai/vision-providers";
import { withTimeout } from "@/lib/async-timeout";
import {
  classifyCardLane,
  scrubHallucinatedSlabFieldsForRaw,
} from "@/lib/scan/lane";

export const maxDuration = 300;

const MAX_IMAGES_PER_REQUEST = 12;
const MAX_IMAGE_BASE64_CHARS = 24 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BASE64_CHARS = 96 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeCards(cards: unknown[]): unknown[] {
  return cards.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const card = { ...(raw as Record<string, unknown>) };
    const lane = classifyCardLane(card);
    card.visionLane = lane.lane;
    card.visionLaneConfidence = lane.confidence;
    if (lane.lane === "raw" && lane.confidence >= 0.75) {
      return scrubHallucinatedSlabFieldsForRaw(card);
    }
    return card;
  });
}

function summarizeVisionFailure(errors: string[]): string {
  const joined = errors.join(" | ");
  const hints: string[] = [];
  if (/quota|rate limit/i.test(joined)) {
    hints.push(
      "Add VISION_SKIP_PROVIDERS=gemini,openai in .env.local or wait for quota reset. Groq + OpenRouter are the reliable free paths.",
    );
  }
  if (/truncated|invalid JSON|salvaged/i.test(joined)) {
    hints.push(
      "Large binder pages may need a second scan; compact retry runs automatically when JSON is truncated.",
    );
  }
  if (/timed out/i.test(joined)) {
    hints.push(
      "Raise VISION_PROVIDER_TIMEOUT_MS=150000 or use a faster OpenRouter vision model.",
    );
  }
  return hints.length > 0 ? `${joined} — ${hints.join(" ")}` : joined;
}

export async function POST(req: NextRequest) {
  await auth.protect();

  let body: {
    imageBase64s?: string[];
    imageMimeTypes?: string[];
    singleCardCrop?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const singleCardCrop = body.singleCardCrop === true;
  const prompt = buildVisionPrompt({ singleCardCrop, compact: false });
  const compactPrompt = buildVisionPrompt({ singleCardCrop, compact: true });
  const timeoutMs = getVisionProviderTimeoutMs();

  const imageBase64s = Array.isArray(body.imageBase64s)
    ? body.imageBase64s.filter((v) => typeof v === "string" && v.length > 0)
    : [];
  const imageMimeTypes = Array.isArray(body.imageMimeTypes)
    ? body.imageMimeTypes.filter(
        (v) => typeof v === "string" && v.startsWith("image/"),
      )
    : [];
  if (imageBase64s.length === 0) {
    return NextResponse.json(
      { error: "imageBase64s required" },
      { status: 400 },
    );
  }
  if (imageBase64s.length > MAX_IMAGES_PER_REQUEST) {
    return NextResponse.json(
      { error: `At most ${MAX_IMAGES_PER_REQUEST} images per scan request` },
      { status: 413 },
    );
  }
  const totalImageChars = imageBase64s.reduce(
    (sum, value) => sum + value.length,
    0,
  );
  if (totalImageChars > MAX_TOTAL_IMAGE_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Image payload too large" },
      { status: 413 },
    );
  }
  for (const [index, value] of imageBase64s.entries()) {
    if (value.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json(
        { error: `Image ${index + 1} is too large` },
        { status: 413 },
      );
    }
    const mimeType = imageMimeTypes[index] ?? "image/jpeg";
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${mimeType}` },
        { status: 415 },
      );
    }
  }

  let appUser;
  try {
    appUser = await syncCurrentAppUser();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to sync user before metered scan",
      },
      { status: 503 },
    );
  }

  if (!appUser) {
    return NextResponse.json(
      { error: "Account database is not configured for metered scans" },
      { status: 503 },
    );
  }

  if (!isMasterAdminEmail(appUser.email)) {
    try {
      const creditResult = await consumeScanCredits({
        userId: appUser.id,
        credits: imageBase64s.length,
        route: "/api/vision/extract",
        metadata: {
          imageCount: imageBase64s.length,
          singleCardCrop,
        },
      });

      if (!creditResult.allowed) {
        return NextResponse.json(
          {
            error: "Scan limit reached",
            reason: creditResult.reason,
            usage: creditResult,
          },
          { status: 429 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Unable to reserve scan credits",
        },
        { status: 503 },
      );
    }
  }

  const enabled = listEnabledVisionProviders();
  if (enabled.length === 0) {
    return NextResponse.json(
      {
        error:
          "No vision providers available. Configure GROQ_API_KEY and/or OPENROUTER_API_KEY, or remove entries from VISION_SKIP_PROVIDERS.",
      },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  const skipped = getVisionSkipProviders();
  if (skipped.length > 0) {
    errors.push(`skipped by config: ${skipped.join(", ")}`);
  }

  for (const providerId of enabled) {
    try {
      const result = await withTimeout(
        runVisionProviderOnce(
          providerId,
          prompt,
          compactPrompt,
          imageBase64s,
          imageMimeTypes,
          { allowCompactRetry: true },
        ),
        timeoutMs,
        providerId,
      );

      if (result.cards.length === 0) {
        errors.push(`${providerId}: empty extraction`);
        continue;
      }

      const normalized = normalizeCards(result.cards);
      const out =
        singleCardCrop && normalized.length > 1
          ? normalized.slice(0, 1)
          : normalized;
      const warnings = [...errors];
      if (result.salvaged || result.compactRetry) {
        warnings.push(
          `${providerId}: ${result.compactRetry ? "compact retry" : "salvaged"} — ${out.length} card(s); re-scan if incomplete`,
        );
      }
      if (result.finishReason === "length") {
        warnings.push(
          `${providerId}: output hit token limit — some cards may be missing`,
        );
      }

      return NextResponse.json({
        cards: out,
        provider: providerId,
        warnings,
        salvaged: result.salvaged,
        compactRetry: result.compactRetry ?? false,
      });
    } catch (err) {
      noteProviderFailure(providerId, err);
      errors.push(formatVisionProviderError(providerId, err));
    }
  }

  return NextResponse.json(
    { error: summarizeVisionFailure(errors), providerErrors: errors },
    { status: 503 },
  );
}
