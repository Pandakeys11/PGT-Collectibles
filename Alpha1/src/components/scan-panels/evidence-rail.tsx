"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileImage, Maximize2, Crop } from "lucide-react";
import { MarketEvidenceTable } from "@/components/scan-panels/market-evidence-table";
import { MarketSourceHub } from "@/components/scan-panels/market-source-hub";
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
import { SpecimenEditFields } from "@/components/scan-panels/specimen-edit-fields";
import { GradedRegistryPanel } from "@/components/scan-panels/graded-registry-panel";
import { SpecimenMarketSummary } from "@/components/scan-panels/specimen-market-summary";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { formatGradedSlabTag, formatSlabLabelLine } from "@/lib/scan/graded-slab";
import { getCardDisplayTitle, getCardImageAlt } from "@/lib/scan/card-display";
import { cn } from "@/lib/cn";
import { displayPrintVersionForSpecimen } from "@/lib/scan/display-print-edition";
import { formatAskingPriceCompact } from "@/lib/scan/specimen-present";

function catalogStatusLabel(status: ScanSpecimen["context"]["catalogIdentityStatus"]): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "likely") return "Likely";
  if (status === "ambiguous") return "Ambiguous";
  return "Unmatched";
}

/** Identity looks stable enough to tuck the panel away in Market Intelligence. */
function identityLooksSettled(specimen: ScanSpecimen): boolean {
  const ctx = specimen.context;
  const hasBasics = Boolean(
    ctx.name?.trim() && (ctx.setName?.trim() || ctx.cardNumber?.trim()),
  );
  const catalogOk =
    ctx.catalogIdentityStatus === "confirmed" || ctx.catalogIdentityStatus === "likely";
  const verifyOk =
    ctx.verificationStatus === "verified" ||
    (ctx.catalogConfidence >= 0.72 && ctx.verificationStatus !== "failed");
  return hasBasics && catalogOk && verifyOk;
}

function identityCollapsedStorageKey(specimenId: string): string {
  return `pgt-liquid-identity-collapsed:${specimenId}`;
}

function IdentityDetailRows({
  specimen,
  dense = false,
}: {
  specimen: ScanSpecimen;
  dense?: boolean;
}) {
  const setLine =
    [specimen.card.set, specimen.card.number, specimen.card.year ?? specimen.context.year]
      .filter(Boolean)
      .join(" · ") || "—";
  const version = displayPrintVersionForSpecimen(specimen);
  const slab = formatSlabLabelLine(specimen.card);
  const grade = formatGradedSlabTag(specimen.card, specimen.context.lane) ?? "—";
  const sticker = formatAskingPriceCompact(specimen);
  const catalog = `${catalogStatusLabel(specimen.context.catalogIdentityStatus)} ${Math.round(specimen.context.catalogConfidence * 100)}% / ${Math.round(specimen.context.confidence * 100)}%`;

  if (dense) {
    const rows: Array<{ label: string; value: string; valueClass?: string }> = [
      { label: "Set · ID", value: setLine },
      { label: "Version", value: version, valueClass: "text-violet-200/95 font-medium" },
      ...(slab ? [{ label: "Slab", value: slab }] : []),
      { label: "Grade", value: grade, valueClass: "font-mono text-slate-200" },
      { label: "Sticker", value: sticker, valueClass: "font-mono text-amber-200/90" },
      { label: "Status", value: catalog },
    ];

    return (
      <dl className="sc-identity-sheet-grid divide-y divide-white/[0.06] rounded-md border border-white/8 bg-white/[0.02]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(4.25rem,5.25rem)_1fr] items-baseline gap-x-2 px-2 py-1"
          >
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {row.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 text-[11px] leading-snug text-slate-300 break-words",
                row.valueClass,
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="space-y-2 text-[11px] sm:text-xs">
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Set · ID · Year</dt>
        <dd className="max-w-[58%] text-right font-medium text-slate-200 break-words">{setLine}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Print / version</dt>
        <dd className="max-w-[58%] text-right font-medium text-violet-200/95 break-words">
          {version}
        </dd>
      </div>
      {slab ? (
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Slab label</dt>
          <dd className="max-w-[58%] text-right text-slate-200 break-words">{slab}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Grade · cert</dt>
        <dd className="max-w-[58%] text-right font-mono text-slate-200 break-words">{grade}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Sticker / ask</dt>
        <dd className="font-mono text-amber-200/90">{sticker}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Catalog · scan</dt>
        <dd className="text-right text-slate-200">{catalog}</dd>
      </div>
    </dl>
  );
}

export function EvidenceRail({
  specimen,
  onRequestAdjustCrop,
  editable = false,
  rowBusy = false,
  enriching = false,
  onUpdate,
  onCommitEdit,
  onRescan,
  variant = "full",
}: {
  specimen: ScanSpecimen | null;
  onRequestAdjustCrop?: () => void;
  /** When true, identity fields are editable and resync/enrich hooks run from the parent. */
  editable?: boolean;
  rowBusy?: boolean;
  enriching?: boolean;
  onUpdate?: (patch: Partial<ExtractedCard>) => void;
  onCommitEdit?: () => void;
  onRescan?: () => void;
  /** Liquid Scan: crop + identity hero only (market blocks live in SpecimenMarketHub). */
  variant?: "full" | "liquid";
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [zoomCaption, setZoomCaption] = useState<string | null>(null);
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const userToggledIdentityRef = useRef(false);
  const zoomSession = useRef(0);
  const specimenRef = useRef(specimen);
  specimenRef.current = specimen;

  useEffect(() => {
    userToggledIdentityRef.current = false;
    if (!specimen?.id) {
      setIdentityCollapsed(false);
      return;
    }
    try {
      const stored = localStorage.getItem(identityCollapsedStorageKey(specimen.id));
      if (stored === "0") {
        setIdentityCollapsed(false);
        return;
      }
      if (stored === "1") {
        setIdentityCollapsed(true);
        return;
      }
    } catch {
      /* private mode */
    }
    setIdentityCollapsed(identityLooksSettled(specimen));
  }, [specimen?.id]);

  useEffect(() => {
    if (!specimen?.id || userToggledIdentityRef.current) return;
    if (identityLooksSettled(specimen)) {
      setIdentityCollapsed(true);
    }
  }, [
    specimen?.id,
    specimen?.context.catalogIdentityStatus,
    specimen?.context.verificationStatus,
    specimen?.context.catalogConfidence,
    specimen?.context.name,
    specimen?.context.setName,
    specimen?.context.cardNumber,
  ]);

  const setIdentityCollapsedPersisted = useCallback((next: boolean) => {
    userToggledIdentityRef.current = true;
    setIdentityCollapsed(next);
    if (!specimen?.id) return;
    try {
      localStorage.setItem(identityCollapsedStorageKey(specimen.id), next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [specimen?.id]);

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
        <div
          className={cn(
            "rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-600",
            variant === "liquid" && "sc-glass-raised",
          )}
        >
          Select a card to view its crop and identity.
        </div>
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

  const cropBlockCompact = variant === "liquid";

  const cropBlock = (
    <div
      className={cn(
        "relative mx-auto w-full shrink-0 sm:mx-0",
        cropBlockCompact ? "max-w-[7.5rem]" : "max-w-[11rem] sm:max-w-[12.5rem]",
      )}
    >
      <SpecimenFrame
        className={cn(
          "ring-1 ring-white/10",
          cropBlockCompact ? "rounded-lg" : "rounded-xl",
        )}
        src={displaySrc}
        alt={getCardImageAlt(specimen.card)}
        graded={specimen.context.lane === "graded"}
        busy={cropping}
        objectFit="contain"
      />
      {hasFullSrc ? (
        <div className="absolute bottom-1 right-1 flex gap-0.5">
          <button
            type="button"
            onClick={() => void openEnlargedCrop()}
            className="flex h-7 items-center gap-0.5 rounded-md border border-white/15 bg-black/65 px-1.5 text-[9px] font-medium text-white/95 backdrop-blur-sm touch-manipulation"
          >
            <Maximize2 className="h-2.5 w-2.5" aria-hidden />
            Zoom
          </button>
          <button
            type="button"
            onClick={openFullUpload}
            className="flex h-7 items-center gap-0.5 rounded-md border border-white/15 bg-black/65 px-1.5 text-[9px] font-medium text-white/95 backdrop-blur-sm touch-manipulation"
          >
            <FileImage className="h-2.5 w-2.5" aria-hidden />
            Full
          </button>
        </div>
      ) : null}
    </div>
  );

  if (variant === "liquid") {
    const settled = identityLooksSettled(specimen);
    const identitySummary = [
      specimen.context.setName,
      specimen.context.cardNumber,
      formatGradedSlabTag(specimen.card, specimen.context.lane),
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <>
        <div className="sc-identity-panel sc-glow-border overflow-hidden rounded-xl sc-glass-raised">
          <div
            className={cn(
              "flex items-start gap-2.5",
              identityCollapsed ? "px-2.5 py-2" : "border-b border-white/8 bg-white/[0.02] px-2.5 py-2",
            )}
          >
            {!identityCollapsed ? cropBlock : null}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                  Card identity
                </p>
                <button
                  type="button"
                  onClick={() => setIdentityCollapsedPersisted(!identityCollapsed)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                  aria-expanded={!identityCollapsed}
                  aria-label={identityCollapsed ? "Expand card identity" : "Collapse card identity"}
                >
                  {identityCollapsed ? "Show" : "Hide"}
                  {identityCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
              <p
                className={cn(
                  "mt-0.5 font-semibold leading-snug text-slate-100",
                  identityCollapsed ? "truncate text-[11px]" : "line-clamp-2 text-[12px]",
                )}
              >
                {getCardDisplayTitle(specimen.card)}
              </p>
              {identityCollapsed && identitySummary ? (
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{identitySummary}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <VerificationPill status={specimen.context.verificationStatus} />
                <GraderChip
                  grader={specimen.card.grader}
                  grade={specimen.card.grade}
                  labelTitle={specimen.card.labelTitle}
                />
                {settled && identityCollapsed ? (
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300/90">
                    {catalogStatusLabel(specimen.context.catalogIdentityStatus)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {!identityCollapsed ? (
            <>
              <div className="px-2.5 py-2">
                <IdentityDetailRows specimen={specimen} dense />
              </div>
              {editable && onUpdate && onCommitEdit && onRescan ? (
                <div className="border-t border-white/8 bg-black/15 px-2.5 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Edit · resync to refresh comps
                  </p>
                  <div className="mt-1.5">
                    <SpecimenEditFields
                      item={specimen}
                      rowBusy={rowBusy}
                      variant="sheet"
                      onUpdate={onUpdate}
                      onCommitEdit={onCommitEdit}
                      onAdjustCrop={onRequestAdjustCrop ?? (() => {})}
                      onRescan={onRescan}
                      hideRemove
                      onRemove={() => {}}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
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

  return (
    <>
      <Card className="desk-surface-raised max-w-full min-w-0 overflow-hidden p-5">
      <h2 className="font-display text-title">Evidence</h2>
      {!editable && hasFullSrc && onRequestAdjustCrop ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="touch-manipulation" onClick={onRequestAdjustCrop}>
            <Crop className="h-3.5 w-3.5" aria-hidden />
            Adjust crop
          </Button>
        </div>
      ) : null}
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
        <GraderChip
          grader={specimen.card.grader}
          grade={specimen.card.grade}
          labelTitle={specimen.card.labelTitle}
        />
      </div>
      {editable && onUpdate && onCommitEdit && onRescan ? (
        <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            Card identity — edit to fix scan, then resync
          </p>
          <div className="mt-2">
            <SpecimenEditFields
              item={specimen}
              rowBusy={rowBusy}
              onUpdate={onUpdate}
              onCommitEdit={onCommitEdit}
              onAdjustCrop={onRequestAdjustCrop ?? (() => {})}
              onRescan={onRescan}
              hideRemove
              onRemove={() => {}}
            />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Catalog</dt>
              <dd className="font-medium text-primary">
                {catalogStatusLabel(specimen.context.catalogIdentityStatus)}{" "}
                <span className="font-mono text-faint">
                  {Math.round(specimen.context.catalogConfidence * 100)}%
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Scan confidence</dt>
              <dd className="font-mono text-primary">
                {Math.round(specimen.context.confidence * 100)}%
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] text-muted">
            Editing set, name, or ID clears a manual catalog pick and re-matches. Use Select below
            to lock the correct catalog card.
          </p>
        </div>
      ) : (
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
            <dt className="text-muted">Print / version</dt>
            <dd className="max-w-[65%] text-right font-medium text-primary break-words">
              {displayPrintVersionForSpecimen(specimen)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Language</dt>
            <dd className="max-w-[65%] text-right text-primary break-words">
              {[specimen.card.language, specimen.card.printedName].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          {formatSlabLabelLine(specimen.card) ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Slab label</dt>
              <dd className="max-w-[65%] text-right text-primary break-words">
                {formatSlabLabelLine(specimen.card)}
              </dd>
            </div>
          ) : null}
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
      )}
      <div className="mt-4">
        <GradedRegistryPanel
          specimen={specimen}
          enriching={enriching || rowBusy}
          variant="default"
        />
      </div>
      <section className="mt-4">
        <SpecimenMarketSummary specimen={specimen} variant="compact" enriching={enriching || rowBusy} />
      </section>
      {specimen.context.catalogCandidates.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
            Top catalog matches ({specimen.context.catalogCandidates.length})
          </h3>
          <p className="mt-0.5 text-[10px] text-muted">
            Full pick list is in Catalog match below.
          </p>
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
        <div className="mt-2 max-h-[min(18rem,42vh)] overflow-y-auto pr-0.5">
          <MarketEvidenceTable
            items={specimen.context.marketEvidence}
            hubLinks={specimen.context.marketSourceLinks}
            card={specimen.card}
            maxRows={12}
          />
        </div>
      </section>
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
