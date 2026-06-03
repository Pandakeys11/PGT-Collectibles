import { NextRequest, NextResponse } from "next/server";
import { purchaseSlabzPack } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ packId: string }> },
) {
  const { packId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const walletAddress =
    typeof (body as { walletAddress?: unknown })?.walletAddress === "string"
      ? (body as { walletAddress: string }).walletAddress
      : "";
  const packName =
    typeof (body as { packName?: unknown })?.packName === "string"
      ? (body as { packName: string }).packName
      : null;

  if (!walletAddress.trim()) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const result = await purchaseSlabzPack(packId, walletAddress, packName);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
