import { redirect } from "next/navigation";
import { scannerHref } from "@/lib/app-routes";

/** Catalog is embedded in the command center. */
export default function PokedexRedirectPage() {
  redirect(scannerHref("catalog"));
}
