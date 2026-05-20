import { redirect } from "next/navigation";
import { SCANNER_PATH } from "@/lib/app-routes";

/** Legacy URL — command center lives at /scanner. */
export default function RedesignRedirectPage() {
  redirect(SCANNER_PATH);
}
