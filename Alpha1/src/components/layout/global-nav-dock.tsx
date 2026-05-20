"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAV_ITEMS, APP_NAV_MORE, activeNavId } from "@/lib/navigation";
import { GlobalMoreMenu } from "@/components/layout/global-more-menu";
import { cn } from "@/lib/cn";

export function GlobalNavDock() {
  const pathname = usePathname();
  const active = activeNavId(pathname);
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-hidden
      >
        <nav
          className="desk-dock pointer-events-auto mx-auto flex max-w-md items-end justify-around gap-0.5 rounded-[1.35rem] px-2 py-2"
          aria-label="Main navigation"
        >
          {APP_NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-2 touch-manipulation transition-colors",
                  isActive ? "text-accent" : "text-muted hover:text-primary",
                )}
              >
                {isActive && !reduceMotion ? (
                  <motion.span
                    layoutId="global-nav-pill"
                    className="absolute inset-0 rounded-2xl bg-accent/10"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : isActive ? (
                  <span className="absolute inset-0 rounded-2xl bg-accent/10" />
                ) : null}
                <Icon className="relative z-[1] h-5 w-5" strokeWidth={isActive ? 2.25 : 1.85} aria-hidden />
                <span className="relative z-[1] text-[10px] font-medium leading-none tracking-wide">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="relative flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-2 text-muted touch-manipulation transition-colors hover:text-primary"
            aria-label="More options"
          >
            <APP_NAV_MORE.icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
            <span className="text-[10px] font-medium leading-none tracking-wide">{APP_NAV_MORE.shortLabel}</span>
          </button>
        </nav>
      </div>
      <GlobalMoreMenu open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
