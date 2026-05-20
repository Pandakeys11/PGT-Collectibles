import Image from "next/image";
import { BrandLogo } from "@/components/branding/brand-logo";
import { BrandTexture } from "@/components/branding/brand-texture";
import { BRAND } from "@/lib/branding";

/** Left rail on sign-in / sign-up — brand story without cluttering the form. */
export function BrandAuthPanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-2xl border border-border-subtle bg-panel/40 lg:flex lg:flex-col lg:justify-between">
      <BrandTexture intensity="medium" />
      <div className="relative z-[1] flex flex-1 flex-col justify-center p-8 xl:p-10">
        <BrandLogo variant="auth" href={null} />
        <div className="mt-8 overflow-hidden rounded-xl border border-border-subtle/80 bg-canvas/40">
          <Image
            src={BRAND.heroNeuralVision}
            alt=""
            width={640}
            height={360}
            className="h-auto w-full object-cover opacity-90"
            priority
          />
        </div>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            Neural vision extraction for raw cards and slabs
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            Catalog match and live market evidence
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            Export-ready session workflow
          </li>
        </ul>
      </div>
    </aside>
  );
}
