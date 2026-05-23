import { redirect } from "next/navigation";
import { liquidScanHref } from "@/lib/app-routes";

/** Catalog opens inside Liquid Scan. */
export default function PokedexRedirectPage() {
  redirect(liquidScanHref("catalog"));
}
