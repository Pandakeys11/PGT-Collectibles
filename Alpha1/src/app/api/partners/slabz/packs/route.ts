import { NextResponse } from "next/server";
import { fetchSlabzPacks } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await fetchSlabzPacks();
  return NextResponse.json(payload);
}
