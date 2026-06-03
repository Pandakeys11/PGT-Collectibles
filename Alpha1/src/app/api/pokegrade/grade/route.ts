import { NextRequest, NextResponse } from "next/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  pokeGradeEngineEnabled,
  tryPokeGradeEngine,
} from "@/lib/pokegrade/engine-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  await syncCurrentAppUser();

  if (!pokeGradeEngineEnabled()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.trim()
      ? body.mimeType.trim()
      : "image/jpeg";

  if (!imageBase64) {
    return NextResponse.json({ ok: false, error: "missing_image" }, { status: 400 });
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 413 });
  }

  const result = await tryPokeGradeEngine({ imageBase64, mimeType });
  if (!result) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  return NextResponse.json(result);
}
