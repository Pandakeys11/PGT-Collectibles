import type { Metadata } from "next";
import { AppRouteShell } from "@/components/layout/app-route-shell";

export const metadata: Metadata = {
  title: {
    default: "PGT Collectibles",
    template: "%s - PGT Collectibles",
  },
  description:
    "Mobile-first Pokemon and TCG card scanner with catalog matching, market evidence, and CSV/JSON export.",
};

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
