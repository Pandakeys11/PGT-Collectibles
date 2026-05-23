import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/app-routes";

/** Ensure `/` is registered on Vercel (build output lists this route). */
export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect(APP_HOME_PATH);
}
