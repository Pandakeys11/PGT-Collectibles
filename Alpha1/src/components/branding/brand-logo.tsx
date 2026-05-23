"use client";

import Image from "next/image";
import Link from "next/link";
import { APP_HOME_PATH } from "@/lib/app-routes";
import { BRAND, BRAND_COPY } from "@/lib/branding";
import { cn } from "@/lib/cn";

export type BrandLogoVariant = "header" | "command" | "auth" | "icon-only";

export function BrandLogo({
  variant = "header",
  href = APP_HOME_PATH,
  className,
  showTagline = true,
}: {
  variant?: BrandLogoVariant;
  href?: string | null;
  className?: string;
  showTagline?: boolean;
}) {
  const isAuth = variant === "auth";
  const isCommand = variant === "command";
  const iconOnly = variant === "icon-only";

  const iconSize = isAuth ? 56 : isCommand ? 44 : 40;
  const iconBox = cn(
    "relative shrink-0 overflow-hidden",
    isCommand
      ? "grid h-11 w-11 place-items-center rounded-lg border border-accent/30 bg-[#070b10] shadow-[0_0_28px_-12px_rgb(var(--accent)/0.85)]"
      : "flex items-center justify-center rounded-xl border border-accent/20 bg-panel-raised/80 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-accent/15",
    !isCommand && (isAuth ? "h-14 w-14 p-2" : "h-10 w-10 p-1.5"),
  );

  const inner = (
    <>
      {!isAuth ? (
        <div className={iconBox}>
          <Image
            src={BRAND.logoIcon}
            alt=""
            width={iconSize}
            height={iconSize}
            className={cn(
              "object-contain transition-transform duration-300 group-hover:scale-105",
              isCommand ? "h-7 w-7" : "h-full w-full",
            )}
            priority={variant === "header" || variant === "command" || iconOnly}
          />
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-accent/10 to-transparent opacity-60"
            aria-hidden
          />
        </div>
      ) : null}

      {!iconOnly ? (
        <div className={cn("min-w-0", isAuth && "text-center")}>
          {isCommand ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-black italic tracking-tight text-primary">
                  {BRAND_COPY.shortName}
                </span>
                <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent">
                  V2
                </span>
              </div>
              {showTagline ? (
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-faint">
                  Collectibles
                </p>
              ) : null}
            </>
          ) : isAuth ? (
            <>
              <Image
                src={BRAND.logoMark}
                alt={BRAND_COPY.name}
                width={280}
                height={80}
                className="mx-auto h-auto w-[min(100%,17.5rem)] object-contain"
                priority
              />
              {showTagline ? (
                <p className="mt-3 text-sm text-muted">{BRAND_COPY.authTagline}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="font-display text-[1.0625rem] font-semibold leading-tight tracking-tight text-primary">
                {BRAND_COPY.name}
              </p>
              {showTagline ? (
                <p className="mt-0.5 text-desk-subtitle">{BRAND_COPY.tagline}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );

  const layout = cn(
    "group flex min-w-0 items-center outline-none ring-offset-2 ring-offset-canvas focus-visible:ring-2 focus-visible:ring-accent/35",
    isAuth ? "flex-col gap-4" : "gap-3",
    isCommand && "gap-3 rounded-md neo-focus-ring",
    !isAuth && !isCommand && "gap-3.5 rounded-xl py-0.5",
    className,
  );

  if (href == null) {
    return <div className={layout}>{inner}</div>;
  }

  return (
    <Link href={href} className={layout}>
      {inner}
    </Link>
  );
}
