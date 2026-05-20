import type { LucideIcon } from "lucide-react";
import { BookOpen, MoreHorizontal, ScanLine, UserRound } from "lucide-react";

export type AppNavId = "scan" | "catalog" | "profile" | "more";

export type AppNavItem = {
  id: AppNavId;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Match pathname prefix (e.g. /scanner matches /scanner?x=1) */
  match: (pathname: string) => boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: "scan",
    href: "/scanner",
    label: "Scan",
    shortLabel: "Scan",
    icon: ScanLine,
    match: (pathname) => pathname.startsWith("/scanner"),
  },
  {
    id: "catalog",
    href: "/scanner?view=catalog",
    label: "Catalog",
    shortLabel: "Catalog",
    icon: BookOpen,
    match: (pathname) => pathname.startsWith("/pokedex"),
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
  if (pathname.startsWith("/scanner")) return "scan";
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
  if (pathname.startsWith("/scanner")) {
    return {
      title: "Command center",
      subtitle: "Scan, catalog, market, and AI insight",
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
    title: "Scan desk",
    subtitle: "Vision, session, and market comps",
  };
}
