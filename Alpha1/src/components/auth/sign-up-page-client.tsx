"use client";

import { SignUp } from "@clerk/nextjs";
import { Play } from "lucide-react";
import { useState } from "react";
import { LiquidScanOnboardingDemo } from "@/components/scanner-chat/liquid-scan-onboarding-demo";
import { APP_HOME_PATH } from "@/lib/app-routes";
import { Button } from "@/components/ui/button";

/** Sign-up form + optional tour (user opens tour manually — never blocks Clerk). */
export function SignUpPageClient() {
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <div className="scanner-chat-root w-full max-w-md">
      <div className="mb-4 flex flex-col gap-2 lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-400/90">
          PGT Liquid Scan
        </p>
        <p className="text-sm text-slate-400">
          Create an account to scan, match catalog rows, and run grade-aware market comps.
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

      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
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
