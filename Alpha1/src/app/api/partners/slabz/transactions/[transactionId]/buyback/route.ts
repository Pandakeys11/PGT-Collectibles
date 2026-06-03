import { NextRequest, NextResponse } from "next/server";
import { initiateSlabzBuyback } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await ctx.params;
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

  const result = await initiateSlabzBuyback(transactionId, walletAddress);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
