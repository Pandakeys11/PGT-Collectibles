import { NextRequest, NextResponse } from "next/server";
import { claimTaskBodySchema } from "@/lib/companion/schemas";
import { claimCompanionTask, parseClientCompanion } from "@/lib/companion/service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = claimTaskBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  try {
    const clientRow = parseClientCompanion(parsed.data.companion);
    const result = await claimCompanionTask(parsed.data.taskId, clientRow);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ...result.payload, rewardXp: result.rewardXp });
  } catch (err) {
    console.error("[companion/tasks/claim]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claim failed" },
      { status: 500 },
    );
  }
}
