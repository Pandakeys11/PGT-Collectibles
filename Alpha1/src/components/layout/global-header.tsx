"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/branding/brand-logo";
import { AuthControls } from "@/components/auth/auth-controls";
import { APP_HOME_PATH } from "@/lib/app-routes";
import { APP_NAV_ITEMS, activeNavId, pageMetaForPath } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function GlobalHeader() {
  const pathname = usePathname();
  const active = activeNavId(pathname);
  const meta = pageMetaForPath(pathname);
  const reduceMotion = useReducedMotion();
  const enter = { duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <header className="desk-surface sticky top-0 z-30 border-b border-transparent">
      <motion.div
        className="mx-auto flex w-full max-w-[100vw] flex-col gap-3 px-5 pb-4 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8 lg:pb-4 xl:px-10"
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enter}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 lg:flex-1 lg:justify-start">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo
              href={APP_HOME_PATH}
              variant="icon-only"
              className="shrink-0 lg:hidden"
            />
            <BrandLogo
              href={APP_HOME_PATH}
              variant="header"
              className="hidden min-w-0 lg:flex"
            />
            <div className="min-w-0 lg:hidden">
              <p className="font-display truncate text-[1.0625rem] font-semibold leading-tight tracking-tight text-primary">
                {meta.title}
              </p>
              <p className="mt-0.5 truncate text-desk-subtitle">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <AuthControls />
          </div>
        </div>

        <nav className="desk-nav-cluster hidden lg:flex" aria-label="Main navigation">
          {APP_NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted hover:text-primary",
                )}
              >
                {isActive && !reduceMotion ? (
                  <motion.span
                    layoutId="global-nav-desktop-pill"
                    className="absolute inset-0 rounded-xl bg-accent/10"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : isActive ? (
                  <span className="absolute inset-0 rounded-xl bg-accent/10" />
                ) : null}
                <Icon className="relative z-[1] h-4 w-4" aria-hidden />
                <span className="relative z-[1]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <AuthControls />
        </div>
      </motion.div>
    </header>
  );
}
