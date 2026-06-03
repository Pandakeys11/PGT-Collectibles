import { NextRequest, NextResponse } from "next/server";
import { getSlabzWalletBalanceForAddress } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!address) {
    return NextResponse.json({ error: "address query param is required" }, { status: 400 });
  }

  const balance = await getSlabzWalletBalanceForAddress(address);
  if (!balance) {
    return NextResponse.json({ error: "Could not load wallet balance" }, { status: 400 });
  }

  return NextResponse.json({ balance });
}
