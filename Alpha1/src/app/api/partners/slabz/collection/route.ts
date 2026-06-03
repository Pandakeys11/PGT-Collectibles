import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveSlabzRipsToUserCollection } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  transactionIds: z.array(z.string().min(1)).max(50).optional(),
  sessionId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

/**
 * Sync completed Slabz rips into the user's saved scan sessions (Recent scans).
 * Omit transactionIds to save all completed rips with revealed slabs.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  const result = await saveSlabzRipsToUserCollection({
    transactionIds: body.transactionIds,
    sessionId: body.sessionId ?? null,
    title: body.title ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    sessionId: result.sessionId,
    savedCount: result.savedCount,
    specimenCount: result.specimenCount,
  });
}
