"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ScanLimitBanner } from "@/components/billing/scan-limit-banner";
import { ScanQuotaChip } from "@/components/billing/scan-quota-chip";
import { ScanQuotaTip } from "@/components/billing/scan-quota-tip";
import { AuthControls } from "@/components/auth/auth-controls";
import { EvidenceCropDialog } from "@/components/scan-panels/evidence-crop-dialog";
import { useCompanion } from "@/hooks/use-companion";
import { useLiquidScanRailLayout } from "@/hooks/use-liquid-scan-rail-layout";
import { useScanQuota } from "@/hooks/use-scan-quota";
import { useScannerChat } from "@/hooks/use-scanner-chat";
import { LiquidScanRailToggle } from "@/components/scanner-chat/liquid-scan-rail-toggle";
import { cn } from "@/lib/cn";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { getActiveCatalogCandidate } from "@/lib/scanner-chat/catalog-match-present";
import { openAppraisalPrint } from "@/lib/scan/appraisal-export";
import { downloadSpecimensCsv, downloadSpecimensJson } from "@/lib/scan/export";
import { ChatMessageList } from "./chat-message";
import { EmptyScannerState } from "./empty-scanner-state";
import { LiquidScanQuickActions } from "./liquid-scan-quick-actions";
import { MobileResultsDrawer } from "./mobile-results-drawer";
import { MobileResultsFab } from "./mobile-results-fab";
import type { MarketIntelIdleAction } from "./market-intelligence-idle-showcase";
import { ScanIntelligencePanel } from "./scan-intelligence-panel";
import { ScannerComposer } from "./scanner-composer";
import { ScannerHeader } from "./scanner-header";
import { ScannerSidebar, type SidebarNavId } from "./scanner-sidebar";
import { MasterCatalogSessionPanel } from "@/components/catalog/master-catalog-session-panel";
import { prefetchMasterCatalogDefaults } from "@/lib/catalog/catalog-fetch-cache";
import { EbayEndingSoonProvider } from "./ebay-ending-soon-provider";
import { SlabzPartnerProvider } from "./slabz-partner-provider";
import { LiveMarketTickerProvider } from "./live-market-ticker-provider";
import { LiquidScanPanelBootstrap } from "./liquid-scan-panel-bootstrap";
import { UploadDropzoneOverlay } from "./upload-dropzone";
import { LiquidScanLiveCamera } from "./liquid-scan-live-camera";
export function ScannerChatShell() {
  const chat = useScannerChat();
  const { navCollapsed, intelCollapsed, toggleNav, toggleIntel } = useLiquidScanRailLayout();
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const companion = useCompanion();
  const { quota, isPro } = useScanQuota();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prefetchMasterCatalogDefaults();
  }, []);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);

  const cropTarget = useMemo(
    () => chat.specimens.find((item) => item.id === cropTargetId) ?? null,
    [chat.specimens, cropTargetId],
  );

  const hasUserActivity = useMemo(
    () => chat.messages.some((m) => m.role === "user"),
    [chat.messages],
  );

  const scrollToBottom = useCallback(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  /** Only follow the feed when a new message row is appended — not catalog/card actions. */
  const feedTailKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const msgs = chat.messages;
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1]!;
    const tailKey = `${msgs.length}:${last.id}`;
    const prev = feedTailKeyRef.current;
    feedTailKeyRef.current = tailKey;
    if (prev === null) return;

    const [prevLenStr, prevId] = prev.split(":");
    const prevLen = Number(prevLenStr);
    const grew = msgs.length > prevLen;
    const newTail = last.id !== prevId;
    if (!grew && !newTail) return;

    scrollToBottom();
  }, [chat.messages, scrollToBottom]);

  const catalogOpenedRef = useRef(false);
  useEffect(() => {
    if (!chat.catalogPanelOpen) {
      catalogOpenedRef.current = false;
      return;
    }
    if (catalogOpenedRef.current) return;
    catalogOpenedRef.current = true;
    requestAnimationFrame(() => {
      feedRef.current
        ?.querySelector(".sc-catalog-session-slot")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [chat.catalogPanelOpen]);

  const handleSubmit = useCallback(() => {
    if (!chat.isBusy) void chat.runComposerSubmit();
  }, [chat]);

  const handleExport = useCallback(
    (format: string) => {
      if (chat.specimens.length === 0) return;
      if (format === "pdf") {
        if (!isPro) {
          chat.appendAssistantMessage(
            "Premium PDF appraisals are included with Pro. Upgrade under Usage & plans to print valuation sheets with comps and FMV.",
          );
          return;
        }
        openAppraisalPrint(chat.specimens);
        return;
      }
      if (format === "json") downloadSpecimensJson(chat.specimens);
      else downloadSpecimensCsv(chat.specimens);
    },
    [chat, isPro],
  );

  const handleCorrectMatch = useCallback(
    (specimenId: string) => {
      chat.setSelectedSpecimenId(specimenId);
      const specimen = chat.specimens.find((s) => s.id === specimenId);
      if (!specimen) return;
      const pick = getActiveCatalogCandidate(specimen.context);
      if (pick) {
        chat.handleConfirmCandidateForSpecimen(specimenId, pick);
      }
    },
    [chat],
  );

  const handleWrongMatch = useCallback(
    (specimenId: string) => {
      chat.setSelectedSpecimenId(specimenId);
      const specimen = chat.specimens.find((s) => s.id === specimenId);
      if (!specimen) return;
      const pick = getActiveCatalogCandidate(specimen.context);
      if (pick) {
        chat.handleRejectCandidateForSpecimen(specimenId, pick.catalogId);
      }
    },
    [chat],
  );

  const handleViewComps = useCallback(
    (specimenId: string) => {
      chat.setSelectedSpecimenId(specimenId);
      chat.setResultsDrawerOpen(true);
      requestAnimationFrame(() => chat.scrollToComps());
    },
    [chat],
  );

  const cardHandlers = useMemo(
    () => ({
      selectedSpecimenId: chat.selectedSpecimenId,
      onSelectSpecimen: chat.setSelectedSpecimenId,
      onCorrectMatch: handleCorrectMatch,
      onWrongMatch: handleWrongMatch,
      onViewComps: handleViewComps,
      onAddToCollection: (specimenId: string) => void chat.saveSpecimenToCollection(specimenId),
      onExclude: chat.handleExcludeSpecimen,
      onConfirmCatalogCandidate: chat.handleConfirmCandidateForSpecimen,
      onRejectCatalogCandidate: chat.handleRejectCandidateForSpecimen,
      onRefreshCatalogCandidates: chat.handleRefreshCatalogCandidatesForSpecimen,
      onOpenMasterCatalog: chat.openCatalogOutput,
      catalogRefreshingId: chat.catalogRefreshingId,
      catalogBusy: chat.enrichingSpecimenId != null,
    }),
    [chat, handleCorrectMatch, handleWrongMatch, handleViewComps],
  );

  const reviewUncertain = useCallback(() => {
    const uncertain = chat.cards.find((c) => c.status !== "verified");
    if (uncertain) chat.setSelectedSpecimenId(uncertain.specimenId);
    chat.setResultsDrawerOpen(true);
  }, [chat]);

  const openCropForSelected = useCallback(() => {
    if (chat.selectedSpecimenId) setCropTargetId(chat.selectedSpecimenId);
  }, [chat.selectedSpecimenId]);

  const selectedDigitalScanAsset = useMemo(() => {
    if (!chat.selectedSpecimenId) return null;
    return chat.digitalScanAssets[chat.selectedSpecimenId] ?? null;
  }, [chat.digitalScanAssets, chat.selectedSpecimenId]);

  const handleDownloadSelectedDigitalScan = useCallback(() => {
    if (!selectedDigitalScanAsset) return;
    chat.downloadSingleDigitalScan(selectedDigitalScanAsset);
  }, [chat, selectedDigitalScanAsset]);

  const handleIntelIdleAction = useCallback(
    (action: MarketIntelIdleAction) => {
      switch (action) {
        case "live-market":
          chat.openLiveMarketOutput();
          break;
        case "ebay-ending":
          chat.openEbayEndingOutput();
          break;
        case "slabz-rip":
          chat.openSlabzRipOutput();
          break;
        case "catalog":
          chat.openCatalogOutput();
          break;
        case "calculator":
          chat.openCalculatorOutput();
          break;
        case "companion":
          chat.openCompanionOutput();
          break;
        case "youtube":
          chat.openPgtYoutubeOutput();
          break;
        case "arcade":
          chat.openPgtArcadeOutput();
          break;
      }
    },
    [chat],
  );

  const intelligenceCropProps = useMemo(
    () => ({
      onRequestAdjustCrop: openCropForSelected,
      onRescanSpecimen: chat.selectedSpecimenId
        ? () => void chat.rescanSpecimen(chat.selectedSpecimenId!)
        : undefined,
      onUpdateSpecimen: chat.handleUpdateSpecimen,
      onCommitSpecimenEdit: chat.handleCommitSpecimenEdit,
      rescanningId: chat.rescanningId,
      onIdleAction: handleIntelIdleAction,
    }),
    [chat, handleIntelIdleAction, openCropForSelected],
  );

  return (
    <LiveMarketTickerProvider>
    <EbayEndingSoonProvider>
    <SlabzPartnerProvider>
    <div className="scanner-chat-root flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden">
      <Suspense fallback={null}>
        <LiquidScanPanelBootstrap
          onOpenCatalog={chat.openCatalogOutput}
          onOpenCompanion={chat.openCompanionOutput}
          onOpenCalculator={chat.openCalculatorOutput}
          onOpenLiveMarket={chat.openLiveMarketOutput}
          onOpenEbayEnding={chat.openEbayEndingOutput}
          onOpenPgtYoutube={chat.openPgtYoutubeOutput}
          onOpenPgtArcade={chat.openPgtArcadeOutput}
          onOpenSlabzRip={chat.openSlabzRipOutput}
          onCatalogPrefill={(prefill) => void chat.loadCatalogPrefill(prefill)}
        />
      </Suspense>
      <UploadDropzoneOverlay
        onFiles={chat.addImages}
        disabled={chat.isScanning}
        queuedCount={chat.uploadQueuedCount}
      />
      <ScannerHeader
        onMenuClick={() => chat.setSidebarOpen(true)}
        onResultsClick={() => chat.setResultsDrawerOpen(true)}
        showResultsToggle={chat.specimens.length > 0}
        resultsCount={chat.specimens.length}
        quota={quota}
      />
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <ScannerSidebar
          mobileOpen={chat.sidebarOpen}
          onMobileClose={() => chat.setSidebarOpen(false)}
          desktopCollapsed={navCollapsed}
          onToggleDesktopCollapsed={toggleNav}
          onNewScan={chat.resetScan}
          canExport={chat.specimens.length > 0}
          recentSessions={chat.recentSessions}
          recentLoading={chat.recentLoading}
          activeSessionId={chat.loadedSessionId}
          loadingSessionId={chat.loadingSessionId}
          historyExpanded={chat.historyExpanded}
          onToggleHistory={() => chat.setHistoryExpanded((v) => !v)}
          onLoadSession={(id) => void chat.loadSession(id)}
          onDeleteSession={(id) => void chat.deleteSession(id)}
          onClearRecentSessions={() => void chat.clearRecentSessions()}
          clearingHistory={chat.clearingHistory}
          onSaveScan={() => void chat.saveToCollection()}
          canSaveScan={chat.specimens.length > 0}
          savingScan={chat.saving}
          onOpenLiveMarket={chat.openLiveMarketOutput}
          onOpenPgtYoutube={chat.openPgtYoutubeOutput}
          onNav={(id: SidebarNavId) => {
            if (id === "catalog") chat.openCatalogOutput();
            else if (id === "live-market") chat.openLiveMarketOutput();
            else if (id === "pgt-youtube") chat.openPgtYoutubeOutput();
            else if (id === "pgt-arcade") chat.openPgtArcadeOutput();
            else if (id === "ebay-ending") chat.openEbayEndingOutput();
            else if (id === "slabz-rip") chat.openSlabzRipOutput();
            else if (id === "companion") chat.openCompanionOutput();
            else if (id === "calculator") chat.openCalculatorOutput();
            else if (id === "exports") handleExport("csv");
            else if (id === "history") chat.setHistoryExpanded((v) => !v);
            else if (id === "watchlist") {
              chat.appendAssistantMessage(
                "Watchlist is coming soon. Save cards to your collection and open Saved from the sidebar.",
              );
            }
          }}
        />
        <main className="sc-liquid-scan-main relative flex min-h-0 w-full min-w-0 flex-1 flex-col transition-[max-width] duration-200 ease-out">
          <div ref={feedRef} className="sc-mobile-workspace-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scanner-chat-scrollbar">
            <div
              className="sc-mobile-feed sc-desktop-chat-feed min-h-0 flex-none overflow-x-hidden overflow-y-visible py-4 sm:px-6 lg:px-5 lg:py-5 xl:px-6"
            >
            <div className="sc-mobile-feed-inner sc-desktop-feed-inner mx-auto w-full max-w-none space-y-4 lg:max-w-none">
              <div className="lg:hidden">
                <ScanQuotaTip quota={quota} />
              </div>
              {chat.scanLimit ? (
                <ScanLimitBanner
                  limit={chat.scanLimit}
                  onDismiss={chat.clearScanLimit}
                  className="sc-glass-raised"
                />
              ) : null}
              {chat.isGeneratingReport ? (
                <p className="text-[11px] text-emerald-400/90">Writing session intelligence report…</p>
              ) : null}
              {chat.progress && (chat.isScanning || chat.isEnriching || chat.digitalScanRendering) && !chat.isAsking && !chat.isGeneratingReport ? (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
                  {chat.digitalScanRendering && chat.digitalScanProgress
                    ? `Digital Scan ${chat.digitalScanProgress.done}/${chat.digitalScanProgress.total}${chat.digitalScanProgress.currentLabel ? ` · ${chat.digitalScanProgress.currentLabel}` : ""}…`
                    : chat.progress}
                </p>
              ) : null}
              {!hasUserActivity ? (
                <EmptyScannerState onChipClick={(text) => void chat.handlePromptChip(text)} />
              ) : null}
              <ChatMessageList
                messages={chat.messages}
                specimens={chat.specimens}
                sessionSummary={chat.summary}
                cardHandlers={cardHandlers}
                companion={companion}
                onCatalogScanPrefill={(prefill) => void chat.loadCatalogPrefill(prefill)}
                onOpenSlabzRipInScan={(rip, pack) => void chat.loadSlabzRipInScan(rip, pack)}
                onDismissMessage={chat.dismissMessage}
                digitalScanOn={chat.digitalScanOn}
                digitalScanAssets={chat.digitalScanAssetsList}
                digitalScanRendering={chat.digitalScanRendering}
                digitalScanProgress={chat.digitalScanProgress}
                digitalScanSessionTitle={chat.digitalScanSessionTitle}
                onDownloadDigitalScanZip={(attest) => void chat.handleDownloadDigitalScanZip(attest)}
                onSaveDigitalScansToVault={() => void chat.saveDigitalScansToVault()}
                onDownloadSingleDigitalScan={chat.downloadSingleDigitalScan}
                vaultSaving={chat.vaultSaving}
                scanPipelineActive={
                  chat.isScanning || chat.enriching || chat.marketEnriching
                }
                scanProgressLabel={chat.progress}
                scanSessionKey={chat.activeScanId}
                className={hasUserActivity ? "" : "mt-6 sm:mt-8"}
              />
            </div>
            </div>
            <MobileResultsFab
              visible={!!chat.summary && !chat.resultsDrawerOpen && !chat.catalogPanelOpen}
              cardCount={chat.specimens.length}
              scanning={chat.isScanning || chat.isEnriching}
              onOpen={() => chat.setResultsDrawerOpen(true)}
            />
            {chat.catalogPanelMounted ? (
              <MasterCatalogSessionPanel
                open={chat.catalogPanelOpen}
                onClose={chat.closeCatalogPanel}
                onCatalogScanPrefill={(prefill) => void chat.loadCatalogPrefill(prefill)}
                className="sc-catalog-session-slot mx-2 mb-3 mt-1 flex shrink-0 flex-col sm:mx-3 lg:mx-4"
              />
            ) : null}
          </div>
          <div className="sc-composer-stack shrink-0 border-t border-white/6 bg-chrome-deep/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md sm:px-4 lg:px-5">
            {hasUserActivity ? (
              <LiquidScanQuickActions
                compact
                onChipClick={(text) => void chat.handlePromptChip(text)}
                className="mb-2 rounded-xl border border-white/8 bg-white/[0.03] px-1.5 py-2"
              />
            ) : null}
            <ScannerComposer
            className="sc-mobile-composer"
            prompt={chat.prompt}
            onPromptChange={chat.setPrompt}
            images={chat.images}
            onFiles={chat.addImages}
            onRemoveImage={chat.removeImage}
            onReorderImages={chat.reorderImages}
            onSubmit={handleSubmit}
            isBusy={chat.isBusy}
            uploadsLocked={chat.isScanning}
            hasImages={chat.images.length > 0}
            hasScanResults={chat.specimens.length > 0}
            speedOn={chat.speedOn}
            onSpeedOnChange={chat.setLiquidScanSpeedOn}
            digitalScanOn={chat.digitalScanOn}
            onDigitalScanOnChange={chat.setDigitalScanOn}
            onOpenLiveCamera={() => setLiveCameraOpen(true)}
            onOpenCalculator={() => chat.openCalculatorOutput()}
            onOpenLiveMarket={() => chat.openLiveMarketOutput()}
            onOpenEbayEnding={() => chat.openEbayEndingOutput()}
            onOpenPgtYoutube={() => chat.openPgtYoutubeOutput()}
            onOpenPgtArcade={() => chat.openPgtArcadeOutput()}
            reviewSpecimen={
              chat.selectedSpecimen?.context.catalogIdentityStatus !== "confirmed" ||
              chat.selectedSpecimen?.context.verificationStatus !== "verified"
                ? chat.selectedSpecimen
                : null
            }
            onConfirmCatalogCandidate={chat.handleConfirmCandidateForSpecimen}
            onRejectCatalogCandidate={chat.handleRejectCandidateForSpecimen}
            onRefreshCatalogCandidates={chat.handleRefreshCatalogCandidatesForSpecimen}
            onOpenMasterCatalog={chat.openCatalogOutput}
            catalogRefreshingId={chat.catalogRefreshingId}
            catalogBusy={chat.enrichingSpecimenId != null}
            />
          </div>
        </main>
        <aside
          className={cn(
            "sc-liquid-scan-intel-rail hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out lg:flex lg:flex-col",
            intelCollapsed ? "w-11" : "w-[min(100%,380px)] xl:w-[420px]",
            !intelCollapsed && "border-l border-white/6",
          )}
          aria-label="Market intelligence"
          data-collapsed={intelCollapsed ? "true" : "false"}
        >
          {intelCollapsed ? (
            <div className="sc-liquid-scan-intel-collapsed flex h-full min-h-0 w-full flex-col items-center gap-1 bg-[rgb(6,8,12)]/95 py-3">
              <LiquidScanRailToggle label="Expand market intelligence" onClick={toggleIntel} edge="strip">
                <PanelRightOpen className="h-4 w-4" aria-hidden />
              </LiquidScanRailToggle>
              <div className="my-1 h-px w-6 bg-white/10" aria-hidden />
              <LiquidScanRailToggle
                label="Open scan results"
                edge="strip"
                onClick={() => {
                  if (chat.specimens.length > 0) chat.setResultsDrawerOpen(true);
                }}
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
              </LiquidScanRailToggle>
              <p
                className="mt-auto select-none pb-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-faint [writing-mode:vertical-rl]"
                aria-hidden
              >
                Intel
              </p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <LiquidScanRailToggle
                    label="Collapse market intelligence"
                    onClick={toggleIntel}
                    edge="inline"
                  >
                    <PanelRightClose className="h-4 w-4" aria-hidden />
                  </LiquidScanRailToggle>
                  <AuthControls redirectUrl={LIQUID_SCAN_PATH} />
                </div>
                <ScanQuotaChip quota={quota} compact />
              </div>
              <ScanIntelligencePanel
                {...intelligenceCropProps}
                summary={chat.summary}
                cards={chat.cards}
                selectedSpecimen={chat.selectedSpecimen}
                selectedSpecimenId={chat.selectedSpecimenId}
                enrichingSpecimenId={chat.enrichingSpecimenId}
                catalogEnriching={chat.enriching}
                marketEnriching={chat.marketEnriching}
                onSelectSpecimen={chat.setSelectedSpecimenId}
                onConfirmCandidate={chat.handleConfirmCandidate}
                onRejectCandidate={chat.handleRejectCandidate}
                onRefreshCatalogCandidates={chat.handleRefreshCatalogCandidates}
                refreshingCatalogCandidates={chat.refreshingCatalogCandidates}
                onExport={handleExport}
                onNewScan={chat.resetScan}
                onReviewUncertain={reviewUncertain}
                onSaveCollection={() => void chat.saveToCollection()}
                saveStatus={chat.saveStatus}
                saving={chat.saving}
                loadedSessionId={chat.loadedSessionId}
                historyRefreshKey={chat.historyRefreshKey}
                compsSectionRef={chat.compsSectionRef}
                isPro={isPro}
                onOpenMasterCatalog={chat.openCatalogOutput}
                digitalScanAsset={selectedDigitalScanAsset}
                onDownloadDigitalScan={handleDownloadSelectedDigitalScan}
                className="min-h-0 flex-1"
              />
            </>
          )}
        </aside>
      </div>
      {cropTarget?.previewUrl ? (
        <EvidenceCropDialog
          open={Boolean(cropTargetId)}
          onOpenChange={(open) => {
            if (!open) setCropTargetId(null);
          }}
          imageSrc={cropTarget.previewUrl}
          userCenter={cropTarget.userEvidenceCropCenter}
          userRadiusMultiplier={cropTarget.userEvidenceCropRadiusMultiplier}
          autoCenter={cropTarget.evidenceCropLocation}
          gradedSlab={cropTarget.context.lane === "graded"}
          rescanning={chat.rescanningId === cropTargetId}
          onApply={(crop) => {
            if (cropTargetId) chat.setUserEvidenceCrop(cropTargetId, crop);
          }}
          onResyncWithCrop={(crop) => {
            if (!cropTargetId) return;
            void chat.rescanSpecimen(cropTargetId, crop);
          }}
        />
      ) : null}
      <LiquidScanLiveCamera
        open={liveCameraOpen}
        onClose={() => setLiveCameraOpen(false)}
        laneMode={chat.laneMode}
        busy={chat.isBusy}
        onCapturePhoto={(file) => chat.addImages([file])}
        onAddToSession={(result, file) => {
          chat.ingestLiveCameraScan(result, file);
          chat.setResultsDrawerOpen(true);
        }}
      />
      <MobileResultsDrawer
        open={chat.resultsDrawerOpen && !!chat.summary && chat.specimens.length > 0}
        {...intelligenceCropProps}
        onClose={() => chat.setResultsDrawerOpen(false)}
        summary={chat.summary}
        cards={chat.cards}
        specimens={chat.specimens}
        cardHandlers={cardHandlers}
        selectedSpecimen={chat.selectedSpecimen}
        selectedSpecimenId={chat.selectedSpecimenId}
        enrichingSpecimenId={chat.enrichingSpecimenId}
        catalogEnriching={chat.enriching}
        marketEnriching={chat.marketEnriching}
        onSelectSpecimen={chat.setSelectedSpecimenId}
        onConfirmCandidate={chat.handleConfirmCandidate}
        onRejectCandidate={chat.handleRejectCandidate}
        onRefreshCatalogCandidates={chat.handleRefreshCatalogCandidates}
        refreshingCatalogCandidates={chat.refreshingCatalogCandidates}
        onExport={handleExport}
        onSaveCollection={() => void chat.saveToCollection()}
        saveStatus={chat.saveStatus}
        saving={chat.saving}
        loadedSessionId={chat.loadedSessionId}
        historyRefreshKey={chat.historyRefreshKey}
        onNewScan={chat.resetScan}
        compsSectionRef={chat.compsSectionRef}
        onReviewUncertain={reviewUncertain}
        isPro={isPro}
        onOpenMasterCatalog={chat.openCatalogOutput}
        digitalScanAsset={selectedDigitalScanAsset}
        onDownloadDigitalScan={handleDownloadSelectedDigitalScan}
      />
    </div>
    </SlabzPartnerProvider>
    </EbayEndingSoonProvider>
    </LiveMarketTickerProvider>
  );
}
