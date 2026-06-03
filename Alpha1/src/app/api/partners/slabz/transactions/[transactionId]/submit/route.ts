import { NextRequest, NextResponse } from "next/server";
import { submitSlabzTransaction } from "@/lib/slabz/service";

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

  const signedTransaction =
    typeof (body as { signedTransaction?: unknown })?.signedTransaction === "string"
      ? (body as { signedTransaction: string }).signedTransaction
      : "";

  if (!signedTransaction.trim()) {
    return NextResponse.json({ error: "signedTransaction is required" }, { status: 400 });
  }

  const result = await submitSlabzTransaction(transactionId, signedTransaction);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
