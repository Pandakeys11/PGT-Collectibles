import { redirect } from "next/navigation";

/** Ensure `/` is registered on Vercel (build output lists this route). */
export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect("/scanner");
}
