import { NextRequest, NextResponse } from "next/server";
import { syncSlabzTransaction } from "@/lib/slabz/service";
import { isSlabzPartnerConfigured } from "@/lib/slabz/config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await ctx.params;
  if (!isSlabzPartnerConfigured()) {
    return NextResponse.json({ error: "Slabz not configured" }, { status: 503 });
  }
  try {
    const transaction = await syncSlabzTransaction(transactionId);
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ transaction });
  } catch (err) {
    console.error("[partners/slabz/transactions/[id]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load transaction" },
      { status: 502 },
    );
  }
}
