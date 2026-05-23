import { NextResponse } from "next/server";
import { listCatalogFranchises } from "@/lib/catalog/catalog-browse-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const franchises = await listCatalogFranchises();
    return NextResponse.json({ franchises });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
