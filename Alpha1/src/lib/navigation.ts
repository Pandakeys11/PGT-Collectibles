import type { LucideIcon } from "lucide-react";
import { BookOpen, Droplets, MoreHorizontal, UserRound } from "lucide-react";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { isLegacyScannerPath, isLiquidScanPath } from "@/lib/route-paths";

export type AppNavId = "scan" | "catalog" | "profile" | "more";

export type AppNavItem = {
  id: AppNavId;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: "scan",
    href: LIQUID_SCAN_PATH,
    label: "PGT Liquid Scan",
    shortLabel: "Scan",
    icon: Droplets,
    match: (pathname) => isLiquidScanPath(pathname) || isLegacyScannerPath(pathname),
  },
  {
    id: "catalog",
    href: `${LIQUID_SCAN_PATH}?panel=catalog`,
    label: "Catalog",
    shortLabel: "Catalog",
    icon: BookOpen,
    match: (pathname) =>
      pathname.startsWith("/pokedex") || isLiquidScanPath(pathname),
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    shortLabel: "Profile",
    icon: UserRound,
    match: (pathname) =>
      pathname.startsWith("/profile") ||
      pathname.startsWith("/saved") ||
      pathname.startsWith("/usage"),
  },
];

export const APP_NAV_MORE: AppNavItem = {
  id: "more",
  href: "#more",
  label: "More",
  shortLabel: "More",
  icon: MoreHorizontal,
  match: () => false,
};

export function activeNavId(pathname: string): AppNavId {
  if (isLiquidScanPath(pathname) || isLegacyScannerPath(pathname)) return "scan";
  if (pathname.startsWith("/pokedex")) return "catalog";
  if (pathname.startsWith("/profile") || pathname.startsWith("/saved") || pathname.startsWith("/usage")) {
    return "profile";
  }
  return "scan";
}

export type AppPageMeta = {
  title: string;
  subtitle: string;
};

export function pageMetaForPath(pathname: string): AppPageMeta {
  if (isLiquidScanPath(pathname) || isLegacyScannerPath(pathname)) {
    return {
      title: "PGT Liquid Scan",
      subtitle: "AI chat scan, match, and market intelligence",
    };
  }
  if (pathname.startsWith("/pokedex")) {
    return {
      title: "Catalog",
      subtitle: "Sets, variants, and reference pricing",
    };
  }
  if (pathname.startsWith("/saved")) {
    return {
      title: "Saved cards",
      subtitle: "Master extracted list",
    };
  }
  if (pathname.startsWith("/usage")) {
    return {
      title: "Usage",
      subtitle: "Credits, limits, and beta access",
    };
  }
  if (pathname.startsWith("/profile")) {
    return {
      title: "Profile",
      subtitle: "Account, beta plan, and settings",
    };
  }
  return {
    title: "PGT Liquid Scan",
    subtitle: "AI chat scan, match, and market intelligence",
  };
}
