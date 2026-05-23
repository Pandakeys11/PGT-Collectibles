import { redirect } from "next/navigation";
import { legacyScannerRedirectUrl } from "@/lib/app-routes";
import {
  isLegacyScannerRedirectDisabled,
  LEGACY_SCANNER_GONE_MESSAGE,
} from "@/lib/legacy-scanner";

export const dynamic = "force-dynamic";

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isLegacyScannerRedirectDisabled()) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400/90">
          410 Gone
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Legacy scanner removed</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{LEGACY_SCANNER_GONE_MESSAGE}</p>
        <a
          href="/liquid-scan"
          className="mt-6 inline-flex rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Open Liquid Scan
        </a>
      </main>
    );
  }

  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  redirect(legacyScannerRedirectUrl(params));
}
