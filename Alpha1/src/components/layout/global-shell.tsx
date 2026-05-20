"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SpriteManifestProvider } from "@/components/companion/sprite-manifest-loader";
import { VisionBackdrop } from "@/components/effects/vision-backdrop";
import { GlobalHeader } from "@/components/layout/global-header";
import { GlobalNavDock } from "@/components/layout/global-nav-dock";
import { PageTransition } from "@/components/motion/page-transition";
import { cn } from "@/lib/cn";

export function GlobalShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isCommandCenter = pathname.startsWith("/scanner");

  if (isCommandCenter) {
    return (
      <SpriteManifestProvider>
        <div className="relative min-h-screen">{children}</div>
      </SpriteManifestProvider>
    );
  }

  return (
    <SpriteManifestProvider>
      <div className="relative min-h-screen">
        <VisionBackdrop />
        <div className="relative z-10 flex min-h-screen flex-col">
          <GlobalHeader />
          <AnimatePresence mode="wait">
            <PageTransition key={pathname}>
              <main
                className={cn(
                  "mx-auto w-full max-w-[100vw] flex-1 px-5 py-6 sm:px-6 lg:max-w-none lg:px-8 lg:py-8 xl:px-10",
                  "pb-global-nav lg:pb-8",
                  className,
                )}
              >
                {children}
              </main>
            </PageTransition>
          </AnimatePresence>
          <GlobalNavDock />
        </div>
      </div>
    </SpriteManifestProvider>
  );
}
