import { NextResponse } from "next/server";
import { flushAllRuntimeCaches } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";

export async function POST() {
  flushAllRuntimeCaches();
  return NextResponse.json({ ok: true });
}
