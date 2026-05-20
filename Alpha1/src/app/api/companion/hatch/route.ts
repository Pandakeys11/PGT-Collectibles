import { NextRequest, NextResponse } from "next/server";
import { hatchBodySchema } from "@/lib/companion/schemas";
import { hatchCompanionForUser } from "@/lib/companion/service";

export async function POST(req: NextRequest) {
  try {
    await req.json().catch(() => ({}));
    hatchBodySchema.parse({});
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await hatchCompanionForUser();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ...result.payload,
      reveal: result.pokemon,
      companion: result.companion,
    });
  } catch (err) {
    console.error("[companion/hatch]", err);
    const message = err instanceof Error ? err.message : "Hatch failed";
    return NextResponse.json(
      {
        error: message,
        hint: "If this persists, run supabase/migrations/202605180002_companion.sql or use local save (refresh after hatch).",
      },
      { status: 500 },
    );
  }
}
