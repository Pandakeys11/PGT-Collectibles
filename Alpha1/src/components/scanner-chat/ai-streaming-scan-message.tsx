"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { AssistantChatMessage } from "@/lib/scanner-chat/types";
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
import {
  ScanResultsViewToggle,
  type ScanResultsView,
} from "./scan-results-view-toggle";
import type { CardInteractionHandlers } from "./chat-message";
import { cn } from "@/lib/cn";

const MOBILE_RESULTS_MQ = "(max-width: 1023px)";

function subscribeMobileResultsMq(onStoreChange: () => void) {
  const mq = window.matchMedia(MOBILE_RESULTS_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getMobileResultsSnapshot() {
  return window.matchMedia(MOBILE_RESULTS_MQ).matches;
}

function getMobileResultsServerSnapshot() {
  return false;
}

export function AIStreamingScanMessage({
  message,
  specimens = [],
  cardHandlers,
  companion,
  onCatalogScanPrefill,
  onDismissOutput,
}: {
  message: AssistantChatMessage;
  specimens?: ScanSpecimen[];
  cardHandlers?: CardInteractionHandlers;
  companion?: CompanionController;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  onDismissOutput?: () => void;
}) {
  const isMobileSheetList = useSyncExternalStore(
    subscribeMobileResultsMq,
    getMobileResultsSnapshot,
    getMobileResultsServerSnapshot,
  );
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
    message.output?.kind === "catalog" || message.output?.kind === "companion";

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
          <div className="rounded-xl rounded-tl-md border border-white/6 sc-glass-raised px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
            <LiquidAskMarkdown text={message.text} />
          </div>
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
                variant={isMobileSheetList ? "mobile-list" : "table"}
                selectedSpecimenId={cardHandlers?.selectedSpecimenId}
                onRowSelect={cardHandlers?.onSelectSpecimen}
              />
            ) : (
              <ExtractedCardsCarousel
                cards={liveCards}
                scannedAt={message.createdAt}
                selectedSpecimenId={cardHandlers?.selectedSpecimenId}
                onSelectSpecimen={cardHandlers?.onSelectSpecimen}
                onCorrectMatch={cardHandlers?.onCorrectMatch}
                onWrongMatch={cardHandlers?.onWrongMatch}
                onViewComps={cardHandlers?.onViewComps}
                onAddToCollection={cardHandlers?.onAddToCollection}
                onExclude={cardHandlers?.onExclude}
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
          ) : message.output.kind === "catalog" && onCatalogScanPrefill ? (
            <LiquidChatOutputPanel
              kind="catalog"
              onCatalogScanPrefill={onCatalogScanPrefill}
              onDismiss={onDismissOutput}
            />
          ) : null
        ) : null}
      </div>
    </motion.article>
  );
}
