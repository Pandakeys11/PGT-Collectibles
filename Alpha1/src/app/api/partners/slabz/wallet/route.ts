import { NextRequest, NextResponse } from "next/server";
import { clearSlabzWalletForCurrentUser, saveSlabzWallet } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
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

  const result = await saveSlabzWallet(walletAddress);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function DELETE() {
  const result = await clearSlabzWalletForCurrentUser();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
