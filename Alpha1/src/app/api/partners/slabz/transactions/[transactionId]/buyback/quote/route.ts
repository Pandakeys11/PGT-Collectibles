import { NextResponse } from "next/server";
import { fetchSlabzBuybackQuote } from "@/lib/slabz/service";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ transactionId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { transactionId } = await ctx.params;
  try {
    const quote = await fetchSlabzBuybackQuote(transactionId);
    return NextResponse.json({ quote });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote failed" },
      { status: 502 },
    );
  }
}
