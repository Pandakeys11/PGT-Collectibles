import { NextRequest, NextResponse } from "next/server";
import { actionBodySchema } from "@/lib/companion/schemas";
import { parseClientCompanion, runCompanionAction } from "@/lib/companion/service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const clientRow = parseClientCompanion(parsed.data.companion);
    const result = await runCompanionAction(parsed.data.action, clientRow);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.payload);
  } catch (err) {
    console.error("[companion/action]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 },
    );
  }
}
