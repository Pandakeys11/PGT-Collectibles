import { NextRequest, NextResponse } from "next/server";
import { parseClientCompanion, recordCompanionQuestEventForUser } from "@/lib/companion/service";
import { questEventBodySchema } from "@/lib/companion/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = questEventBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const clientRow = parseClientCompanion(parsed.data.companion);
    const result = await recordCompanionQuestEventForUser(
      parsed.data.event,
      parsed.data.amount ?? 1,
      clientRow,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.payload);
  } catch (err) {
    console.error("[companion/quest-event]", err);
    const message = err instanceof Error ? err.message : "Quest update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
