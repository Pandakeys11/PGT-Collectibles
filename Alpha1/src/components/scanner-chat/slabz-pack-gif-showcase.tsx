"use client";

import { useMemo } from "react";
import { SlabzPackVisual } from "@/components/scanner-chat/slabz-pack-visual";
import { getSlabzPackArtMeta, resolveSlabzPackImageUrl } from "@/lib/slabz/pack-art";
import type { SlabzPack } from "@/lib/slabz/types";
import { cn } from "@/lib/cn";

export function SlabzPackGifShowcase({
  packs,
  className,
}: {
  packs: SlabzPack[];
  className?: string;
}) {
  const withGif = useMemo(
    () =>
      packs.filter((pack) => {
        const url = resolveSlabzPackImageUrl(pack);
        return Boolean(url?.includes("/packs/gifs/"));
      }),
    [packs],
  );

  if (withGif.length === 0) return null;

  return (
    <section className={cn("sc-slabz-gif-showcase", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
          Pack rip previews
        </p>
        <p className="text-[9px] text-slate-500">Official Slabz GIFs</p>
      </div>
      <div className="sc-slabz-gif-showcase__track flex gap-3 overflow-x-auto pb-2 scanner-chat-scrollbar">
        {withGif.map((pack) => {
          const meta = getSlabzPackArtMeta(pack);
          return (
            <div
              key={pack.id}
              className="sc-slabz-gif-showcase__item flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-black/25 p-2 ring-1 ring-cyan-400/10"
            >
              <div className={cn("rounded-lg", meta.glowClass)}>
                <SlabzPackVisual pack={pack} size="hero" variant="rip" className="!mx-0" />
              </div>
              <p className="max-w-[4.5rem] truncate text-center text-[8px] font-medium text-slate-300">
                {pack.name}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
