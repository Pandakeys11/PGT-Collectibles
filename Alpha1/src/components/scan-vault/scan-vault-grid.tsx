"use client";

import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ScanVaultRow } from "@/lib/digital-scan/types";
import { marketPokemonHref } from "@/lib/app-routes";

export function ScanVaultGrid({ rows }: { rows: ScanVaultRow[] }) {
  const bySession = new Map<string, ScanVaultRow[]>();
  for (const row of rows) {
    const key = row.sessionId ?? "unsorted";
    const list = bySession.get(key) ?? [];
    list.push(row);
    bySession.set(key, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(bySession.entries()).map(([sessionId, sessionRows]) => (
        <section
          key={sessionId}
          className="rounded-lg border border-white/[0.08] bg-[#0b1118]/70 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300">
              Session · {sessionRows.length} file{sessionRows.length === 1 ? "" : "s"}
            </p>
            {sessionId !== "unsorted" ? (
              <span className="font-mono text-[10px] text-slate-600">{sessionId.slice(0, 8)}…</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sessionRows
              .sort((a, b) => (a.cardIndexOnPage ?? 0) - (b.cardIndexOnPage ?? 0))
              .map((row) => (
                <article
                  key={row.id}
                  className="group overflow-hidden rounded-lg border border-white/8 bg-black/30"
                >
                  <div className="relative aspect-[3/4] bg-black/50">
                    {row.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.publicUrl}
                        alt={row.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-600">
                        No preview
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/90 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                      {row.publicUrl ? (
                        <a
                          href={row.publicUrl}
                          download={row.filename}
                          className="flex flex-1 items-center justify-center gap-1 rounded bg-violet-500/80 py-1 text-[9px] font-semibold text-white"
                        >
                          <Download className="h-3 w-3" />
                          Save
                        </a>
                      ) : null}
                      {row.catalogId ? (
                        <Link
                          href={marketPokemonHref(row.catalogId)}
                          className="flex items-center justify-center rounded bg-white/10 p-1 text-white"
                          title="Market intel"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="truncate text-[11px] font-medium text-slate-200">{row.name}</p>
                    <p className="truncate font-mono text-[9px] text-slate-500">{row.filename}</p>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
