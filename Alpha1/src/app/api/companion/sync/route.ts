import { NextRequest, NextResponse } from "next/server";
import { parsePersistedRow } from "@/lib/companion/game-engine";
import { syncCompanionFromClient } from "@/lib/companion/service";

/** Local-storage fallback when Supabase is not configured. */
export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = parsePersistedRow((body as { companion?: unknown })?.companion ?? body);
  if (!row) {
    return NextResponse.json({ error: "Invalid companion payload" }, { status: 400 });
  }

  const result = await syncCompanionFromClient(row);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload);
}
