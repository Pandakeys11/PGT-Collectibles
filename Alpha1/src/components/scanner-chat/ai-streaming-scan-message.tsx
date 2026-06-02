"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { AssistantChatMessage, ScanSummary } from "@/lib/scanner-chat/types";
import type { CompanionController } from "@/hooks/use-companion";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import {
  buildScanSummaryFromSpecimens,
  specimenToCardMatch,
} from "@/lib/scanner-chat/specimen-present";
import { ExtractedCardsCarousel } from "./extracted-cards-carousel";
import { LiquidAskResponsePanel } from "./liquid-ask-response";
import { LiquidChatOutputPanel } from "./liquid-chat-output";
import { LiquidAskMarkdown } from "./liquid-ask-markdown";
import { ScanSummaryInline } from "./scan-summary-panel";
import { ScanResultsSheet } from "./scan-results-sheet";
import { ScanResultsViewToggle,
  type ScanResultsView,
} from "./scan-results-view-toggle";
import { DigitalScanHowToPanel } from "./digital-scan-how-to-panel";
import { DigitalScanResultsStrip } from "./digital-scan-results-strip";
import type { DigitalScanAsset } from "@/lib/digital-scan/types";
import type { CardInteractionHandlers } from "./chat-message";
import { cn } from "@/lib/cn";

export function AIStreamingScanMessage({
  message,
  specimens = [],
  sessionSummary = null,
  cardHandlers,
  companion,
  onCatalogScanPrefill,
  onDismissOutput,
  digitalScanOn,
  digitalScanAssets,
  digitalScanRendering,
  digitalScanProgress,
  digitalScanSessionTitle,
  onDownloadDigitalScanZip,
  onSaveDigitalScansToVault,
  onDownloadSingleDigitalScan,
  vaultSaving,
  onDismissHowTo,
}: {
  message: AssistantChatMessage;
  specimens?: ScanSpecimen[];
  sessionSummary?: ScanSummary | null;
  cardHandlers?: CardInteractionHandlers;
  companion?: CompanionController;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  onDismissOutput?: () => void;
  digitalScanOn?: boolean;
  digitalScanAssets?: DigitalScanAsset[];
  digitalScanRendering?: boolean;
  digitalScanProgress?: { done: number; total: number; currentLabel?: string } | null;
  digitalScanSessionTitle?: string;
  onDownloadDigitalScanZip?: (includeAttestation?: boolean) => void;
  onSaveDigitalScansToVault?: () => void;
  onDownloadSingleDigitalScan?: (asset: DigitalScanAsset) => void;
  vaultSaving?: boolean;
  onDismissHowTo?: () => void;
}) {
  const [resultsView, setResultsView] = useState<ScanResultsView>("cards");

  const isLiveScan = Boolean(message.streaming && !message.scanReport);

  const liveSpecimens = useMemo(() => {
    if (isLiveScan && specimens.length > 0) return specimens;
    if (!message.cards?.length || specimens.length === 0) return [];
    const ids = new Set(message.cards.map((c) => c.specimenId));
    return specimens.filter((s) => ids.has(s.id));
  }, [isLiveScan, message.cards, specimens]);

  const liveCards = useMemo(() => {
    if (liveSpecimens.length > 0) {
      return liveSpecimens.map((s, i) => specimenToCardMatch(s, i));
    }
    return message.cards ?? [];
  }, [liveSpecimens, message.cards]);

  const liveSummary = useMemo(() => {
    if (liveSpecimens.length === 0) return message.summary ?? null;
    return buildScanSummaryFromSpecimens(liveSpecimens);
  }, [liveSpecimens, message.summary]);

  const showResults = liveCards.length > 0;
  const showAskSpinner = !message.scanReport && !showResults && !message.output;
  const showDoneNarrative =
    !message.scanReport && !showAskSpinner && message.text.trim().length > 0 && !isLiveScan;
  const wideEmbed =
    message.output?.kind === "catalog" ||
    message.output?.kind === "companion" ||
    message.output?.kind === "calculator" ||
    message.output?.kind === "live-market" ||
    message.output?.kind === "ebay-ending" ||
    message.output?.kind === "pgt-youtube";

  const calculatorFmv =
    sessionSummary?.estimatedTotal ??
    liveSummary?.estimatedTotal ??
    message.summary?.estimatedTotal ??
    0;
  const calculatorCards =
    sessionSummary?.totalDetected ??
    liveSummary?.totalDetected ??
    message.summary?.totalDetected ??
    specimens.length;

  const showDigitalScanStrip =
    digitalScanOn &&
    !message.digitalScanHowTo &&
    (message.id === "pending-result" || Boolean(message.cards?.length)) &&
    Boolean(digitalScanAssets?.length || digitalScanRendering);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex w-full min-w-0 gap-3 max-lg:gap-0"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/25 to-sky-500/20 ring-1 ring-emerald-400/20 max-lg:hidden sm:h-8 sm:w-8 sm:rounded-xl">
        <Sparkles className="h-3.5 w-3.5 text-emerald-300 sm:h-4 sm:w-4" />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 space-y-2.5 sm:space-y-3 max-lg:w-full",
          wideEmbed && "sc-assistant-wide-embed",
        )}
      >
        {message.scanReport ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              Session intelligence report
            </p>
            <LiquidAskResponsePanel
              narrative={message.text}
              research={message.askResearch}
              provider={message.askProvider}
              streaming={message.streaming}
              statusMessage={message.askStatus}
            />
          </div>
        ) : showAskSpinner ? (
          <LiquidAskResponsePanel
            narrative={message.text}
            research={message.askResearch}
            provider={message.askProvider}
            streaming={message.streaming}
            statusMessage={message.askStatus}
          />
        ) : showDoneNarrative ? (
          <div className="rounded-xl rounded-tl-md border border-white/6 sc-glass-raised px-2.5 py-2 text-xs leading-relaxed sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
            <LiquidAskMarkdown text={message.text} />
          </div>
        ) : null}

        {message.digitalScanHowTo ? (
          <DigitalScanHowToPanel
            markdown={message.text}
            onDismiss={onDismissHowTo}
          />
        ) : null}

        {showDigitalScanStrip ? (
          <DigitalScanResultsStrip
            assets={digitalScanAssets ?? []}
            rendering={digitalScanRendering}
            progress={digitalScanProgress ?? null}
            sessionTitle={digitalScanSessionTitle ?? ""}
            onDownloadZip={(attest) => onDownloadDigitalScanZip?.(attest)}
            onSaveToVault={onSaveDigitalScansToVault}
            onDownloadOne={(asset) => onDownloadSingleDigitalScan?.(asset)}
            savingVault={vaultSaving}
          />
        ) : null}

        {isLiveScan && showResults ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2"
            role="status"
          >
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-amber-300" aria-hidden />
            <p className="text-[11px] leading-snug text-amber-100/95">
              {message.text ||
                "Matching catalog and market — rows update live as each card finishes."}
            </p>
          </div>
        ) : null}

        {liveSummary && showResults ? (
          <ScanSummaryInline summary={liveSummary} compact />
        ) : null}

        {showResults ? (
          <div className="sc-scan-results-block space-y-2 lg:space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {isLiveScan ? "Live scan sheet" : "Scan results"}
              </p>
              <ScanResultsViewToggle
                view={resultsView}
                onViewChange={setResultsView}
                cardCount={liveCards.length}
              />
            </div>
            {resultsView === "sheet" && liveSpecimens.length > 0 ? (
              <ScanResultsSheet
                specimens={liveSpecimens}
                selectedSpecimenId={cardHandlers?.selectedSpecimenId}
                onRowSelect={cardHandlers?.onSelectSpecimen}
              />
            ) : (
              <ExtractedCardsCarousel
                cards={liveCards}
                specimens={liveSpecimens}
                scannedAt={message.createdAt}
                selectedSpecimenId={cardHandlers?.selectedSpecimenId}
                onSelectSpecimen={cardHandlers?.onSelectSpecimen}
                onCorrectMatch={cardHandlers?.onCorrectMatch}
                onWrongMatch={cardHandlers?.onWrongMatch}
                onViewComps={cardHandlers?.onViewComps}
                onAddToCollection={cardHandlers?.onAddToCollection}
                onExclude={cardHandlers?.onExclude}
                onConfirmCatalogCandidate={cardHandlers?.onConfirmCatalogCandidate}
                onRejectCatalogCandidate={cardHandlers?.onRejectCatalogCandidate}
                onRefreshCatalogCandidates={cardHandlers?.onRefreshCatalogCandidates}
                onOpenMasterCatalog={cardHandlers?.onOpenMasterCatalog}
                catalogRefreshingId={cardHandlers?.catalogRefreshingId}
                catalogBusy={cardHandlers?.catalogBusy}
              />
            )}
          </div>
        ) : null}

        {message.output && !message.streaming ? (
          message.output.kind === "companion" && companion ? (
            <LiquidChatOutputPanel
              kind="companion"
              companion={companion}
              onCatalogScanPrefill={onCatalogScanPrefill}
              onDismiss={onDismissOutput}
            />
          ) : message.output.kind === "catalog" ? (
            <p className="text-[11px] text-slate-500">
              Master catalog is open in the panel below.
            </p>
          ) : message.output.kind === "calculator" ? (
            <LiquidChatOutputPanel
              kind="calculator"
              calculatorBaseAmount={calculatorFmv}
              calculatorCardCount={calculatorCards}
              onDismiss={onDismissOutput}
            />
          ) : message.output.kind === "live-market" ? (
            <LiquidChatOutputPanel
              kind="live-market"
              onCatalogScanPrefill={onCatalogScanPrefill}
              onDismiss={onDismissOutput}
            />
          ) : message.output.kind === "ebay-ending" ? (
            <LiquidChatOutputPanel kind="ebay-ending" onDismiss={onDismissOutput} />
          ) : message.output.kind === "pgt-youtube" ? (
            <LiquidChatOutputPanel kind="pgt-youtube" onDismiss={onDismissOutput} />
          ) : null
        ) : null}
      </div>
    </motion.article>
  );
}
