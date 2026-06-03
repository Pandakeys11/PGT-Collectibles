import { NextRequest, NextResponse } from "next/server";
import { getSlabzWalletForUser } from "@/lib/slabz/repository";
import { openSlabzPack } from "@/lib/slabz/service";
import { syncCurrentAppUser } from "@/lib/auth/app-user";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await ctx.params;
  let walletAddress = "";
  try {
    const body = (await req.json()) as { walletAddress?: string };
    walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  } catch {
    /* empty body */
  }

  if (!walletAddress) {
    const appUser = await syncCurrentAppUser();
    if (appUser) {
      const saved = await getSlabzWalletForUser(appUser.id);
      walletAddress = saved?.walletAddress?.trim() ?? "";
    }
  }

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required to open a pack" }, { status: 400 });
  }

  const result = await openSlabzPack(transactionId, walletAddress);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: result.pending ? 202 : 200 });
}
