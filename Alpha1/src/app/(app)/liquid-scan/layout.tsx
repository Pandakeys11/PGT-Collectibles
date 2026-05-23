import type { Metadata } from "next";
import "@/styles/scanner-chat.css";

/** Auth + live scan hooks — do not statically prerender this route. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PGT Liquid Scan",
  description:
    "PGT Liquid Scan — AI chat workspace for Pokémon TCG binder pages, graded slabs, and market intelligence.",
};

export default function LiquidScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
