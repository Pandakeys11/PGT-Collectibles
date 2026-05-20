import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Database, ShieldCheck, TableProperties } from "lucide-react";
import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth/app-user";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { MasterExtractedList, type MasterSavedCardRow } from "@/components/saved/master-extracted-list";

export const metadata = {
  title: "Saved Cards",
};

async function getSavedCards(userId: string): Promise<MasterSavedCardRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("extracted_cards")
    .select(
      "id, name, printed_name, language, set_name, card_number, year, rarity, print_stamps, grader, grade, cert, catalog_id, catalog_confidence, market_snapshot_json, raw_extraction_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MasterSavedCardRow[];
}

export default async function SavedPage() {
  await auth.protect();
  const appUser = await getCurrentAppUser();
  const cards = appUser ? await getSavedCards(appUser.id) : [];
  const cataloged = cards.filter((card) => card.catalog_id).length;
  const withMarket = cards.filter((card) => card.market_snapshot_json?.fairValueUsd != null).length;

  return (
    <div className="-mx-5 -my-6 min-h-[calc(100dvh-5rem)] bg-[#05080c] px-4 py-4 text-slate-100 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-my-8 lg:px-8 lg:py-6 xl:-mx-10 xl:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(103,232,249,0.12),transparent_45%),linear-gradient(135deg,rgba(250,204,21,0.06),transparent_38%),linear-gradient(215deg,rgba(217,70,239,0.08),transparent_42%)]" />

      <div className="relative mx-auto grid w-full max-w-[96rem] gap-5">
        <section className="rounded-lg border border-white/[0.09] bg-[#0b1118]/88 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300 text-[#041016]">
                  <Database className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                    Master extracted list
                  </p>
                  <h1 className="mt-1 truncate text-2xl font-bold text-white">Saved Card Sheet</h1>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Review saved scan sessions, expand each extracted card, edit identity fields, and keep the collector
                master sheet aligned with scanner review details.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/scanner"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Command center
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Saved rows</p>
              <p className="mt-1 font-mono text-2xl text-cyan-100">{cards.length.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Catalog matched</p>
              <p className="mt-1 font-mono text-2xl text-amber-100">{cataloged.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Market ready</p>
              <p className="mt-1 font-mono text-2xl text-emerald-100">{withMarket.toLocaleString()}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/[0.09] bg-[#0b1118]/88 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Persistent sheet</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Saved extraction records</h2>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#070b10] px-3 py-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Inline edits save to master list
            </div>
          </div>
          <MasterExtractedList initialCards={cards} variant="neo" />
        </section>

        <section className="rounded-lg border border-white/[0.09] bg-[#0b1118]/88 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-fuchsia-200">Next sheet actions</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Expand this workspace</h2>
            </div>
            <TableProperties className="h-5 w-5 text-fuchsia-200" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Bulk review", "Batch select rows for grade, source, and export workflows."],
              ["Session groups", "Group saved cards by scan session and collection project."],
              ["Advanced filters", "Filter by catalog status, market value, grade, set, and missing fields."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
                <p className="text-sm font-semibold text-slate-100">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
