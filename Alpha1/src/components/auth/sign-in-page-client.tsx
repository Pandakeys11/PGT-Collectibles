"use client";

import { SignIn } from "@clerk/nextjs";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LIQUID_SCAN_ONBOARDING_STORAGE_KEY,
  LiquidScanOnboardingDemo,
} from "@/components/scanner-chat/liquid-scan-onboarding-demo";
import { APP_HOME_PATH } from "@/lib/app-routes";
import { Button } from "@/components/ui/button";

/** Sign-in form + mobile tour entry (Liquid Scan styled). */
export function SignInPageClient() {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    if (wide.matches) return;
    try {
      if (localStorage.getItem(LIQUID_SCAN_ONBOARDING_STORAGE_KEY) === "1") return;
    } catch {
      /* private mode */
    }
    const timer = window.setTimeout(() => setTourOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="scanner-chat-root w-full max-w-md">
      <div className="mb-4 flex flex-col gap-2 lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-400/90">
          PGT Liquid Scan
        </p>
        <p className="text-sm text-slate-400">
          AI card scan, catalog match, and grade-aware market comps — one workspace after you sign in.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="sc-glass w-full border-white/8 text-slate-200 hover:bg-white/5"
          onClick={() => setTourOpen(true)}
        >
          <Play className="mr-1.5 h-4 w-4 text-cyan-400" />
          See 5-step tour
        </Button>
      </div>

      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={APP_HOME_PATH}
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full",
          },
        }}
      />

      <LiquidScanOnboardingDemo open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  );
}
