"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { catalogImageLookupName, localizedPrintedName } from "@/lib/scan/card-display";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/cn";

type Props = {
  specimenId: string;
  card: ExtractedCard;
  catalogImageUrl?: string | null;
  className?: string;
};

function isPlaceholderIdentity(card: ExtractedCard): boolean {
  const name = card.name?.trim().toLowerCase() ?? "";
  const set = card.set?.trim().toLowerCase() ?? "";
  if (!name || name === "—") return true;
  if (/resolving|pending|unknown|registry lookup/.test(name)) return true;
  if (/pending|registry lookup/.test(set)) return true;
  return false;
}

export function CatalogCardThumb({ specimenId, card, catalogImageUrl, className }: Props) {
  const [url, setUrl] = useState<string | null>(catalogImageUrl?.trim() || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setUrl(catalogImageUrl?.trim() || null);
  }, [catalogImageUrl, specimenId]);

  useEffect(() => {
    if (url) return;
    if (isPlaceholderIdentity(card)) return;
    const name = catalogImageLookupName(card);
    if (!name || name === "—") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const q = new URLSearchParams({ name });
      if (card.set?.trim()) q.set("set", card.set.trim());
      if (card.number?.trim()) q.set("number", card.number.trim());
      if (card.printStamps?.trim()) q.set("printStamps", card.printStamps.trim());
      const printed = localizedPrintedName(card);
      if (printed) q.set("printedName", printed);
      if (card.language?.trim()) q.set("language", card.language.trim());
      void fetch(`/api/pokedex/catalog-thumb?${q}`)
        .then((r) => r.json())
        .then((j: { match?: { imageSmallUrl?: string | null } | null }) => {
          if (cancelled) return;
          const u = j?.match?.imageSmallUrl;
          if (typeof u === "string" && u.trim()) setUrl(u.trim());
        })
        .catch(() => {});
    }, catalogImageUrl ? 0 : 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [url, card, specimenId, catalogImageUrl]);

  const frame = cn(
    "pointer-events-none flex h-11 w-[2.125rem] shrink-0 select-none items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-panel-raised/90 sm:h-12 sm:w-9",
    className,
  );

  if (!url || failed) {
    return (
      <div className={cn(frame, "p-1")} aria-hidden>
        <Image
          src={BRAND.logoIcon}
          alt=""
          width={28}
          height={28}
          className="h-full w-full object-contain opacity-70"
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-contain p-px [image-rendering:-webkit-optimize-contrast]"
        loading={catalogImageUrl ? "eager" : "lazy"}
        fetchPriority={catalogImageUrl ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
