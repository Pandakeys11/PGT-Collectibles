import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, FileImage } from "lucide-react";
import Link from "next/link";
import type { ScanVaultRow } from "@/lib/digital-scan/types";
import { ScanVaultGrid } from "@/components/scan-vault/scan-vault-grid";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  listDigitalScanAssetsForUser,
  publicScanVaultUrl,
} from "@/lib/digital-scan/persist-digital-scans";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const metadata = {
  title: "Scan Vault",
};

async function loadVaultRows(userId: string): Promise<ScanVaultRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const rows = await listDigitalScanAssetsForUser(supabase, userId, 300);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  return rows.map((row) => {
    const sidecar = (row.sidecar_json ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      sessionId: row.session_id,
      filename: row.filename,
      mime: row.mime,
      width: row.width,
      height: row.height,
      cardIndexOnPage: row.card_index_on_page,
      lane: row.lane,
      catalogId: row.catalog_id,
      sidecar,
      createdAt: row.created_at,
      publicUrl: supabaseUrl ? publicScanVaultUrl(supabaseUrl, row.storage_path) : null,
      name: typeof sidecar.name === "string" ? sidecar.name : row.filename,
    };
  });
}

export default async function ScanVaultPage() {
  await auth.protect();
  const appUser = await syncCurrentAppUser();
  const rows = appUser ? await loadVaultRows(appUser.id) : [];

  return (
    <div className="-mx-5 -my-6 min-h-[calc(100dvh-5rem)] bg-[#05080c] px-4 py-4 text-slate-100 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-my-8 lg:px-8 lg:py-6 xl:-mx-10 xl:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.12),transparent_45%)]" />

      <div className="relative mx-auto w-full max-w-[96rem] space-y-5">
        <section className="rounded-lg border border-white/[0.09] bg-[#0b1118]/88 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-violet-300/20 bg-violet-400/15 text-violet-100">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200">
                  Digital Scan Vault
                </p>
                <h1 className="text-2xl font-bold text-white">Scanner-grade card library</h1>
              </div>
            </div>
            <Link
              href="/liquid-scan"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-violet-300/20 bg-violet-300/10 px-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-300/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Liquid Scan
            </Link>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Saved digital scans from Liquid Scan sessions — one high-resolution file per card with
            sidecar metadata. Enable <strong className="font-medium text-slate-300">Digital Scan</strong>{" "}
            in the composer, run a scan, then save to vault or download a ZIP locally.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Vault files</p>
              <p className="mt-1 font-mono text-2xl text-violet-100">{rows.length.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Sessions</p>
              <p className="mt-1 font-mono text-2xl text-sky-100">
                {new Set(rows.map((r) => r.sessionId).filter(Boolean)).size.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Graded</p>
              <p className="mt-1 font-mono text-2xl text-amber-100">
                {rows.filter((r) => r.lane === "graded").length.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-6 py-16 text-center">
            <FileImage className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">No digital scans saved yet.</p>
            <p className="mt-1 text-xs text-slate-600">
              Turn on Digital Scan in Liquid Scan, upload cards, then tap Scan Vault in the results strip.
            </p>
          </div>
        ) : (
          <ScanVaultGrid rows={rows} />
        )}
      </div>
    </div>
  );
}
