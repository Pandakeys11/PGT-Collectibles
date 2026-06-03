import { NextResponse } from "next/server";
import { getSlabzPartnerPayload } from "@/lib/slabz/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getSlabzPartnerPayload();
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[partners/slabz/status]", err);
    return NextResponse.json(
      {
        capabilities: {
          configured: false,
          network: "devnet" as const,
          apiBaseUrl: "",
          docsUrl: "https://api-docs.slabz.com/",
        },
        signedIn: false,
        profile: null,
        recentRips: [],
        error: err instanceof Error ? err.message : "Failed to load Slabz status",
      },
      { status: 500 },
    );
  }
}
