import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { cleanId } from "@/lib/http/params";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";

type MergedFile = {
  version?: number;
  sets?: Record<
    string,
    Record<string, Record<string, { small?: string; large?: string }>>
  >;
};

let cached: { path: string; mtimeMs: number; data: MergedFile } | null = null;

registerRuntimeCacheClear(() => {
  cached = null;
});

function loadMergedManifest(): MergedFile | null {
  const raw = process.env.CATALOG_VARIANT_ARTWORK_MERGED_PATH?.trim();
  if (!raw) return null;
  const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  if (!fs.existsSync(abs)) return null;
  const st = fs.statSync(abs);
  if (cached && cached.path === abs && cached.mtimeMs === st.mtimeMs)
    return cached.data;
  const text = fs.readFileSync(abs, "utf8");
  const data = JSON.parse(text) as MergedFile;
  cached = { path: abs, mtimeMs: st.mtimeMs, data };
  return data;
}

/** Per-card variant images from PGT Market export (`CATALOG_VARIANT_ARTWORK_MERGED_PATH` in `.env.example`). */
export async function GET(req: NextRequest) {
  const setId = cleanId(new URL(req.url).searchParams.get("setId"));
  if (!setId) {
    return NextResponse.json(
      { error: "valid setId is required" },
      { status: 400 },
    );
  }

  try {
    const merged = loadMergedManifest();
    const cards = merged?.sets?.[setId] ?? {};
    return NextResponse.json({
      setId,
      hasMergedFile: Boolean(merged),
      cards,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
