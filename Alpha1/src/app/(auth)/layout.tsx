import { BrandLogo } from "@/components/branding/brand-logo";
import { BrandTexture } from "@/components/branding/brand-texture";
import { LiquidScanAuthShowcase } from "@/components/scanner-chat/liquid-scan-auth-showcase";
import { APP_HOME_PATH } from "@/lib/app-routes";
import "@/styles/scanner-chat.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050609] px-4 py-8 text-slate-100 sm:px-6">
      <BrandTexture className="opacity-[0.04]" />
      <div className="relative z-[1] mx-auto grid w-full max-w-5xl gap-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:items-stretch lg:gap-10">
        <LiquidScanAuthShowcase />
        <div className="flex w-full flex-col items-center justify-center">
          <BrandLogo href={APP_HOME_PATH} variant="icon-only" className="mb-6 lg:hidden" />
          {children}
        </div>
      </div>
    </main>
  );
}
