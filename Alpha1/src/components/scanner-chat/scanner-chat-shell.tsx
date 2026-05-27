"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanLimitBanner } from "@/components/billing/scan-limit-banner";
import { ScanQuotaChip } from "@/components/billing/scan-quota-chip";
import { ScanQuotaTip } from "@/components/billing/scan-quota-tip";
import { AuthControls } from "@/components/auth/auth-controls";
import { EvidenceCropDialog } from "@/components/scan-panels/evidence-crop-dialog";
import { useCompanion } from "@/hooks/use-companion";
import { useScanQuota } from "@/hooks/use-scan-quota";
import { useScannerChat } from "@/hooks/use-scanner-chat";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { getActiveCatalogCandidate } from "@/lib/scanner-chat/catalog-match-present";
import { openAppraisalPrint } from "@/lib/scan/appraisal-export";
import { downloadSpecimensCsv, downloadSpecimensJson } from "@/lib/scan/export";
import { ChatMessageList } from "./chat-message";
import { EmptyScannerState } from "./empty-scanner-state";
import { MobileResultsDrawer } from "./mobile-results-drawer";
import { MobileResultsFab } from "./mobile-results-fab";
import { ScanIntelligencePanel } from "./scan-intelligence-panel";
import { ScannerComposer } from "./scanner-composer";
import { ScannerHeader } from "./scanner-header";
import { ScannerSidebar, type SidebarNavId } from "./scanner-sidebar";
import { LiquidScanPanelBootstrap } from "./liquid-scan-panel-bootstrap";
import { UploadDropzoneOverlay } from "./upload-dropzone";
import { LiquidScanLiveCamera } from "./liquid-scan-live-camera";
export function ScannerChatShell() {
  const chat = useScannerChat();
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const companion = useCompanion();
  const { quota, isPro } = useScanQuota();
  const feedRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, chat.cards, scrollToBottom]);

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

  const intelligenceCropProps = useMemo(
    () => ({
      onRequestAdjustCrop: openCropForSelected,
      onRescanSpecimen: chat.selectedSpecimenId
        ? () => void chat.rescanSpecimen(chat.selectedSpecimenId!)
        : undefined,
      onUpdateSpecimen: chat.handleUpdateSpecimen,
      onCommitSpecimenEdit: chat.handleCommitSpecimenEdit,
      rescanningId: chat.rescanningId,
    }),
    [chat, openCropForSelected],
  );

  return (
    <div className="scanner-chat-root flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden">
      <Suspense fallback={null}>
        <LiquidScanPanelBootstrap
          onOpenCatalog={chat.openCatalogOutput}
          onOpenCompanion={chat.openCompanionOutput}
          onOpenCalculator={chat.openCalculatorOutput}
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
        scanning={chat.isBusy}
        quota={quota}
      />
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <ScannerSidebar
          mobileOpen={chat.sidebarOpen}
          onMobileClose={() => chat.setSidebarOpen(false)}
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
          onNav={(id: SidebarNavId) => {
            if (id === "catalog") chat.openCatalogOutput();
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
        <main className="flex w-full min-w-0 flex-1 flex-col">
          <div
            ref={feedRef}
            className="sc-mobile-feed sc-desktop-chat-feed flex-1 overflow-y-auto overflow-x-hidden py-4 sm:px-6 lg:px-5 lg:py-5 xl:px-6 scanner-chat-scrollbar"
          >
            <div className="sc-mobile-feed-inner sc-desktop-feed-inner mx-auto w-full max-w-3xl space-y-3 lg:max-w-none">
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
              {chat.progress && chat.isScanning && !chat.isAsking && !chat.isGeneratingReport ? (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
                  {chat.progress}
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
                onDismissMessage={chat.dismissMessage}
                className={hasUserActivity ? "" : "mt-6 sm:mt-8"}
              />
            </div>
          </div>
          <MobileResultsFab
            visible={!!chat.summary && !chat.resultsDrawerOpen}
            cardCount={chat.specimens.length}
            scanning={chat.isScanning || chat.enriching}
            onOpen={() => chat.setResultsDrawerOpen(true)}
          />
          <ScannerComposer
            className="sc-mobile-composer"
            prompt={chat.prompt}
            onPromptChange={chat.setPrompt}
            images={chat.images}
            scanMode={chat.scanMode}
            onScanModeChange={chat.setScanMode}
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
            onOpenLiveCamera={() => setLiveCameraOpen(true)}
            onOpenCalculator={() => chat.openCalculatorOutput()}
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
        </main>
        <div className="hidden w-[min(100%,380px)] min-w-0 shrink-0 flex-col border-l border-white/6 lg:flex xl:w-[420px]">
          <div className="flex items-center justify-between gap-2 border-b border-white/6 px-4 py-2">
            <AuthControls redirectUrl={LIQUID_SCAN_PATH} />
            <ScanQuotaChip quota={quota} compact />
          </div>
          <ScanIntelligencePanel
            {...intelligenceCropProps}
            summary={chat.summary}
            cards={chat.cards}
            selectedSpecimen={chat.selectedSpecimen}
            selectedSpecimenId={chat.selectedSpecimenId}
            enrichingSpecimenId={chat.enrichingSpecimenId}
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
            className="flex-1"
          />
        </div>
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
      />
    </div>
  );
}
