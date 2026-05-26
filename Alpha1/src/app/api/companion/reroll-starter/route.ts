import { NextRequest, NextResponse } from "next/server";
import { parseClientCompanion, rerollCompanionStarterForUser } from "@/lib/companion/service";
import { rerollStarterBodySchema } from "@/lib/companion/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = rerollStarterBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const clientRow = parseClientCompanion(parsed.data.companion);
    const result = await rerollCompanionStarterForUser(clientRow);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ...result.payload,
      reveal: result.pokemon,
      companion: result.payload.companion,
    });
  } catch (err) {
    console.error("[companion/reroll-starter]", err);
    const message = err instanceof Error ? err.message : "Reroll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
