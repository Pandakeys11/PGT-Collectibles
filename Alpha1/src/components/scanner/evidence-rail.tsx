"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileImage, Maximize2, Crop } from "lucide-react";
import { MarketEvidenceTable } from "@/components/scanner/market-evidence-table";
import { MarketSourceHub } from "@/components/scanner/market-source-hub";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GraderChip } from "@/components/ui/grader-chip";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { SpecimenFrame } from "@/components/ui/specimen-frame";
import { VerificationPill } from "@/components/ui/verification-pill";
import { useSpecimenCropPreview } from "@/hooks/use-specimen-crop-preview";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getEffectiveEvidenceCenter, getEffectiveEvidenceRadiusMultiplier } from "@/hooks/use-scan-session";
import { cropImageWithVisionLocation } from "@/lib/scan/specimen-crop";
import { SpecimenMarketSummary } from "@/components/scanner/specimen-market-summary";
import { formatGradedSlabTag } from "@/lib/scan/graded-slab";
import { getCardImageAlt } from "@/lib/scan/card-display";
import { formatAskingPriceCompact } from "@/lib/scan/specimen-present";

function catalogStatusLabel(status: ScanSpecimen["context"]["catalogIdentityStatus"]): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "likely") return "Likely";
  if (status === "ambiguous") return "Ambiguous";
  return "Unmatched";
}

export function EvidenceRail({
  specimen,
  onRequestAdjustCrop,
}: {
  specimen: ScanSpecimen | null;
  onRequestAdjustCrop?: () => void;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [zoomCaption, setZoomCaption] = useState<string | null>(null);
  const zoomSession = useRef(0);
  const specimenRef = useRef(specimen);
  specimenRef.current = specimen;

  const graded = specimen?.context.lane === "graded";
  const { displaySrc, cropping, hasFullSrc } = useSpecimenCropPreview({
    fullSrc: specimen?.previewUrl ?? null,
    location: specimen?.card.location,
    evidenceCropLocation: specimen ? getEffectiveEvidenceCenter(specimen) : null,
    radiusMultiplier: specimen ? getEffectiveEvidenceRadiusMultiplier(specimen) : undefined,
    gradedSlab: Boolean(graded),
    maxOutputSide: 640,
    enabled: Boolean(specimen?.previewUrl),
  });

  const closeZoom = useCallback(() => {
    zoomSession.current += 1;
    setZoomOpen(false);
    setZoomSrc(null);
    setZoomCaption(null);
  }, []);

  useEffect(() => {
    zoomSession.current += 1;
    setZoomOpen(false);
    setZoomSrc(null);
    setZoomCaption(null);
    // Only reset when the selected row changes; avoid closing on unrelated context updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- specimen?.id
  }, [specimen?.id]);

  const openEnlargedCrop = useCallback(async () => {
    const s = specimenRef.current;
    if (!s?.previewUrl) return;
    const session = ++zoomSession.current;
    const slab = s.context.lane === "graded";
    setZoomOpen(true);
    setZoomCaption("Extracted card crop — loading full resolution…");
    setZoomSrc(displaySrc ?? s.previewUrl);
    const loc = getEffectiveEvidenceCenter(s);
    const hi = await cropImageWithVisionLocation(s.previewUrl, loc, {
      gradedSlab: slab,
      radiusMultiplier: getEffectiveEvidenceRadiusMultiplier(s),
      maxOutputSide: 1680,
      quality: 0.94,
    });
    if (session !== zoomSession.current) return;
    if (hi) {
      setZoomSrc(hi);
    }
    setZoomCaption("Extracted card crop");
  }, [displaySrc]);

  const openFullUpload = useCallback(() => {
    const s = specimenRef.current;
    if (!s?.previewUrl) return;
    zoomSession.current += 1;
    setZoomOpen(true);
    setZoomSrc(s.previewUrl);
    setZoomCaption("Full uploaded capture (uncropped)");
  }, []);

  if (!specimen) {
    return (
      <>
        <Card className="desk-surface-raised max-w-full min-w-0 overflow-hidden p-5">
          <p className="font-display text-title">Evidence</p>
          <p className="mt-2 text-caption">
            Tap a row in the sheet above to load evidence, market comps, and the AI insight canvas.
          </p>
        </Card>
        <ImageLightbox
          src={zoomSrc}
          alt="Preview"
          open={zoomOpen}
          onClose={closeZoom}
          caption={zoomCaption}
        />
      </>
    );
  }

  return (
    <>
      <Card className="desk-surface-raised max-w-full min-w-0 overflow-hidden p-5">
      <h2 className="font-display text-title">Evidence</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasFullSrc && onRequestAdjustCrop ? (
          <Button type="button" variant="secondary" size="sm" className="touch-manipulation" onClick={onRequestAdjustCrop}>
            <Crop className="h-3.5 w-3.5" aria-hidden />
            Adjust crop
          </Button>
        ) : null}
      </div>
      <div className="relative mx-auto mt-4 w-full max-w-[min(100%,13.5rem)] sm:max-w-[15rem]">
        <SpecimenFrame
          className="rounded-2xl ring-1 ring-white/5"
          src={displaySrc}
          alt={getCardImageAlt(specimen.card)}
          graded={specimen.context.lane === "graded"}
          busy={cropping}
          objectFit="contain"
        />
        {hasFullSrc ? (
          <div className="absolute bottom-2 right-2 flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              onClick={() => void openEnlargedCrop()}
              className="flex min-h-[2.5rem] items-center gap-1 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/95 shadow-lg backdrop-blur-sm touch-manipulation hover:bg-black/70 sm:min-h-0 sm:py-1"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Enlarge
            </button>
            <button
              type="button"
              onClick={openFullUpload}
              className="flex min-h-[2.5rem] items-center gap-1 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/95 shadow-lg backdrop-blur-sm touch-manipulation hover:bg-black/70 sm:min-h-0 sm:py-1"
            >
              <FileImage className="h-3.5 w-3.5" aria-hidden />
              Full upload
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VerificationPill status={specimen.context.verificationStatus} />
        <GraderChip grader={specimen.card.grader} />
      </div>
      <dl className="mt-4 space-y-3 text-sm sm:space-y-2 sm:text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Set / ID / Year</dt>
          <dd className="text-right text-primary">
            {[specimen.card.set, specimen.card.number, specimen.card.year ?? specimen.context.year]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Print / stamps</dt>
          <dd className="max-w-[65%] text-right text-primary break-words">
            {specimen.card.printStamps?.trim() || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Language</dt>
          <dd className="max-w-[65%] text-right text-primary break-words">
            {[specimen.card.language, specimen.card.printedName].filter(Boolean).join(" · ") || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Grade / cert</dt>
          <dd className="max-w-[65%] text-right font-mono text-primary break-words">
            {formatGradedSlabTag(specimen.card, specimen.context.lane) ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Sticker / ask</dt>
          <dd className="font-mono text-primary">{formatAskingPriceCompact(specimen)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Confidence</dt>
          <dd className="font-mono text-primary">{Math.round(specimen.context.confidence * 100)}%</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Catalog match</dt>
          <dd className="text-right text-primary">
            {catalogStatusLabel(specimen.context.catalogIdentityStatus)}{" "}
            <span className="font-mono text-faint">
              {Math.round(specimen.context.catalogConfidence * 100)}%
            </span>
          </dd>
        </div>
      </dl>
      <section className="mt-4">
        <SpecimenMarketSummary specimen={specimen} variant="hero" />
      </section>
      {specimen.context.catalogCandidates.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Catalog candidates</h3>
          <div className="mt-2 space-y-2 text-xs">
            {specimen.context.catalogCandidates.slice(0, 3).map((candidate) => (
              <div key={candidate.catalogId} className="rounded-lg border border-border-subtle px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium text-primary">
                    {candidate.name}
                    <span className="text-muted"> · {candidate.setName ?? "Unknown set"}</span>
                  </p>
                  <span className="shrink-0 font-mono text-faint">{candidate.score}</span>
                </div>
                <p className="mt-1 text-faint">
                  {[candidate.cardNumber, candidate.year, candidate.rarity].filter(Boolean).join(" · ") || "--"}
                </p>
                {candidate.conflicts.length > 0 ? (
                  <p className="mt-1 text-danger">{candidate.conflicts.join(" · ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="mt-4">
        <MarketSourceHub links={specimen.context.marketSourceLinks} />
      </div>
      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Recent sales and listings</h3>
        <div className="mt-2">
          <MarketEvidenceTable
            items={specimen.context.marketEvidence}
            hubLinks={specimen.context.marketSourceLinks}
            card={specimen.card}
          />
        </div>
      </section>
      {specimen.context.registryUrl ? (
        <a
          href={specimen.context.registryUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-[2.75rem] items-center gap-2 text-base text-accent touch-manipulation sm:min-h-0 sm:text-sm hover:underline"
        >
          Registry
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      </Card>

      <ImageLightbox
        src={zoomSrc}
        alt={getCardImageAlt(specimen.card)}
        open={zoomOpen}
        onClose={closeZoom}
        caption={zoomCaption}
      />
    </>
  );
}
