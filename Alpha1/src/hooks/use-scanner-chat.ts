"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScanSession, type ScanImageSlot } from "@/hooks/use-scan-session";
import { scanModeToLane } from "@/lib/scanner-chat/scan-mode-config";
import {
  buildBatchScanAssistantText,
  buildScanSummaryFromSpecimens,
  progressToScanStep,
  specimenToCardMatch,
} from "@/lib/scanner-chat/specimen-present";
import { readLiquidChatSse } from "@/lib/scanner-chat/read-liquid-chat-sse";
import { isScanAutoReportEnabled } from "@/lib/ai/env";
import {
  readLiquidScanSpeedOn,
  shouldAutoSessionReport,
  writeLiquidScanSpeedOn,
} from "@/lib/scan/liquid-scan-speed";
import { SCAN_REPORT_INTERNAL_MESSAGE } from "@/lib/scanner-chat/liquid-scan-report";
import { restoreSpecimensFromSaved } from "@/lib/scanner-chat/restore-saved-specimens";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import { SYSTEM_SCAN_STEPS } from "@/lib/scanner-chat/mock-data";
import type { CatalogCandidate, ExtractedCard } from "@/lib/scan/schemas";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import type {
  AssistantChatMessage,
  CardMatch,
  ChatMessage,
  ChatOutputKind,
  ScanHistoryItem,
  ScanMode,
  ScanSummary,
  SystemChatMessage,
  UploadedImage,
  UserChatMessage,
} from "@/lib/scanner-chat/types";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME_ASSISTANT: AssistantChatMessage = {
  id: "welcome",
  role: "assistant",
  createdAt: Date.now(),
  text:
    "Welcome to PGT Liquid Scan. Upload binder pages, graded slabs, or singles and I'll extract cards, verify sets, and estimate market value with live catalog match and market comps.",
};

const MAX_ASK_HISTORY = 8;

function chatHistoryFromMessages(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m): m is UserChatMessage | AssistantChatMessage => m.role === "user" || m.role === "assistant")
    .filter((m) => m.id !== "welcome" && m.id !== "pending-result" && m.id !== "pending-ask")
    .slice(-MAX_ASK_HISTORY)
    .map((m) => ({
      role: m.role,
      content:
        m.role === "user"
          ? (m.text?.trim() || (m.images?.length ? `Uploaded ${m.images.length} image(s) for scanning` : ""))
          : m.text.trim(),
    }))
    .filter((m) => m.content.length > 0);
}

function slotsToUploadedImages(slots: ScanImageSlot[]): UploadedImage[] {
  return slots.map((slot) => ({
    id: slot.id,
    file: slot.file,
    previewUrl: slot.previewUrl,
  }));
}

export function useScannerChat() {
  const [speedOn, setSpeedOn] = useState(false);

  useEffect(() => {
    setSpeedOn(readLiquidScanSpeedOn());
  }, []);

  const setLiquidScanSpeedOn = useCallback((on: boolean) => {
    writeLiquidScanSpeedOn(on);
    setSpeedOn(on);
  }, []);

  const session = useScanSession({ speedOn });
  const {
    setLaneMode,
    slots,
    specimens,
    scanning,
    enriching,
    progress,
    error,
    scanLimit,
    clearScanLimit,
    addFiles,
    removeSlot,
    reorderSlots,
    runScan,
    clearSession,
    setSelectedId,
    selectedId,
    confirmCatalogCandidate,
    rejectCatalogCandidate,
    removeSpecimen,
    enrichingSpecimenId,
    hydrateSavedSession,
    ingestCatalogPrefill,
    rescanSpecimen,
    setUserEvidenceCrop,
    rescanningId,
    updateSpecimen,
    flushManualEnrich,
    uploadQueuedCount,
    laneMode,
    ingestLiveCameraScan,
  } = session;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_ASSISTANT]);
  const [scanMode, setScanMode] = useState<ScanMode>("binder");
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resultsDrawerOpen, setResultsDrawerOpen] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [recentSessions, setRecentSessions] = useState<ScanHistoryItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const finalizedScanRef = useRef<string | null>(null);
  const reportScanRef = useRef<string | null>(null);
  const specimensRef = useRef(specimens);
  const compsSectionRef = useRef<HTMLDivElement>(null);

  const selectedSpecimenId = selectedId;
  const setSelectedSpecimenId = setSelectedId;

  const selectedSpecimen = useMemo(
    () => specimens.find((s) => s.id === selectedSpecimenId) ?? null,
    [specimens, selectedSpecimenId],
  );

  useEffect(() => {
    if (specimens.length === 0) {
      setSelectedSpecimenId(null);
      return;
    }
    if (!selectedSpecimenId || !specimens.some((s) => s.id === selectedSpecimenId)) {
      setSelectedSpecimenId(specimens[0]!.id);
    }
  }, [specimens, selectedSpecimenId, setSelectedSpecimenId]);

  useEffect(() => {
    setLaneMode(scanModeToLane(scanMode));
  }, [scanMode, setLaneMode]);

  const refreshRecentSessions = useCallback(async () => {
    setRecentLoading(true);
    try {
      const response = await fetch("/api/saved/sessions?limit=30");
      const payload = (await response.json().catch(() => ({}))) as {
        sessions?: Array<{
          id: string;
          title: string;
          specimenCount: number;
          updatedAt: string;
        }>;
        error?: string;
      };
      if (response.ok && Array.isArray(payload.sessions)) {
        setRecentSessions(
          payload.sessions.map((row) => ({
            id: row.id,
            title: row.title,
            cardCount: row.specimenCount,
            timestamp: new Date(row.updatedAt).getTime(),
          })),
        );
      }
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRecentSessions();
  }, [refreshRecentSessions, historyRefreshKey]);

  const images = useMemo(() => slotsToUploadedImages(slots), [slots]);

  const cards: CardMatch[] = useMemo(
    () => specimens.map((s, i) => specimenToCardMatch(s, i)),
    [specimens],
  );

  const summary: ScanSummary | null = useMemo(
    () => (specimens.length > 0 ? buildScanSummaryFromSpecimens(specimens) : null),
    [specimens],
  );

  useEffect(() => {
    specimensRef.current = specimens;
  }, [specimens]);

  const isScanning = scanning || enriching;
  const isBusy = isScanning || isAsking || isGeneratingReport;

  const syncProgressMessages = useCallback(
    (progress: string | null, scanId: string | null) => {
      if (!scanId || !progress) return;
      const step = progressToScanStep(progress);
      if (!step) return;

      setMessages((prev) => {
        const stepIndex = SYSTEM_SCAN_STEPS.findIndex((s) => s.step === step);
        const nextSystem: SystemChatMessage[] = SYSTEM_SCAN_STEPS.slice(0, stepIndex + 1).map(
          (s, i) => ({
            id: `${scanId}-${s.step}`,
            role: "system" as const,
            createdAt: Date.now(),
            step: s.step,
            label: i === stepIndex ? progress : s.label,
            active: i === stepIndex,
            done: i < stepIndex,
          }),
        );

        const withoutPriorSystem = prev.filter(
          (m) => m.role !== "system" || !String(m.id).startsWith(scanId),
        );
        return [...withoutPriorSystem, ...nextSystem];
      });
    },
    [],
  );

  useEffect(() => {
    syncProgressMessages(progress, activeScanId);
  }, [progress, activeScanId, syncProgressMessages]);

  useEffect(() => {
    if (!activeScanId) return;
    if (!scanning && !enriching) return;
    if (specimens.length === 0) return;

    const resultCards = specimens.map((s, i) => specimenToCardMatch(s, i));
    const scanSummary = buildScanSummaryFromSpecimens(specimens);
    const statusText =
      progress ??
      (scanning
        ? `Extracting cards from your images…`
        : `Extracted ${resultCards.length} card${resultCards.length === 1 ? "" : "s"} — matching catalog and market…`);

    setMessages((prev) => {
      const pending = prev.find((m) => m.id === "pending-result");
      if (!pending || pending.role !== "assistant") return prev;
      return prev.map((m) =>
        m.id === "pending-result" && m.role === "assistant"
          ? {
              ...m,
              streaming: true,
              text: statusText,
              cards: resultCards,
              summary: scanSummary,
            }
          : m,
      );
    });
  }, [activeScanId, scanning, enriching, specimens, progress]);

  useEffect(() => {
    if (!activeScanId || finalizedScanRef.current === activeScanId) return;
    if (scanning || enriching) return;
    if (specimens.length === 0 && !error) return;

    finalizedScanRef.current = activeScanId;

    if (error) {
      const errMsg: AssistantChatMessage = {
        id: uid(),
        role: "assistant",
        createdAt: Date.now(),
        text: error,
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== "pending-result"), errMsg]);
      return;
    }

    const scanSummary = buildScanSummaryFromSpecimens(specimens);
    const resultCards = specimens.map((s, i) => specimenToCardMatch(s, i));
    const text = buildBatchScanAssistantText(specimens, scanSummary);

    setMessages((prev) => {
      const cleaned = prev.filter((m) => m.id !== "pending-result");
      const doneSystem = SYSTEM_SCAN_STEPS.map((s) => ({
        id: `${activeScanId}-${s.step}`,
        role: "system" as const,
        createdAt: Date.now(),
        step: s.step,
        label: s.label,
        done: true,
        active: false,
      }));
      const withoutSystem = cleaned.filter(
        (m) => m.role !== "system" || !String(m.id).startsWith(activeScanId),
      );
      const assistant: AssistantChatMessage = {
        id: uid(),
        role: "assistant",
        createdAt: Date.now(),
        text,
        cards: resultCards,
        summary: scanSummary,
      };
      return [...withoutSystem, ...doneSystem, assistant];
    });
    setResultsDrawerOpen(true);
  }, [activeScanId, scanning, enriching, specimens, error]);

  const generateScanReport = useCallback(async (scanId: string) => {
    if (reportScanRef.current === scanId) return;
    const items = specimensRef.current;
    if (items.length === 0) return;

    reportScanRef.current = scanId;
    const reportMsgId = `scan-report-${scanId}`;
    const finalId = uid();

    setIsGeneratingReport(true);
    setMessages((prev) => [
      ...prev,
      {
        id: reportMsgId,
        role: "assistant",
        createdAt: Date.now(),
        text: "",
        streaming: true,
        scanReport: true,
        askResearch: null,
        askStatus: "Building session intelligence report…",
      },
    ]);

    try {
      const response = await fetch("/api/scan/liquid-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: SCAN_REPORT_INTERNAL_MESSAGE,
          history: [],
          contexts: items.map((s) => s.context),
          reportMode: "scan_report",
        }),
      });

      let accumulated = "";
      const meta = await readLiquidChatSse(response, {
        onText: (chunk) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === reportMsgId && m.role === "assistant"
                ? { ...m, text: accumulated, streaming: true, askStatus: null }
                : m,
            ),
          );
        },
        onStatus: (_phase, statusMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === reportMsgId && m.role === "assistant"
                ? { ...m, askStatus: statusMsg, streaming: true }
                : m,
            ),
          );
        },
        onResearch: (research) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === reportMsgId && m.role === "assistant"
                ? { ...m, askResearch: research, streaming: true }
                : m,
            ),
          );
        },
      });

      const finalText =
        accumulated.trim() ||
        "Session report could not be generated. Try asking a follow-up question about your scan.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === reportMsgId && m.role === "assistant"
            ? {
                ...m,
                id: finalId,
                text: finalText,
                streaming: false,
                scanReport: true,
                askResearch: meta.research ?? m.askResearch ?? null,
                askProvider: meta.provider,
                askStatus: null,
              }
            : m,
        ),
      );
    } catch (err) {
      const errText =
        err instanceof Error ? err.message : "Session report failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === reportMsgId && m.role === "assistant"
            ? {
                ...m,
                id: finalId,
                text: errText,
                streaming: false,
                scanReport: true,
                askStatus: null,
              }
            : m,
        ),
      );
    } finally {
      setIsGeneratingReport(false);
    }
  }, []);

  useEffect(() => {
    if (!isScanAutoReportEnabled()) return;
    if (!shouldAutoSessionReport(speedOn)) return;
    if (!activeScanId || reportScanRef.current === activeScanId) return;
    if (scanning || enriching) return;
    if (specimens.length === 0 || error) return;
    if (activeScanId.startsWith("saved:")) return;

    void generateScanReport(activeScanId);
  }, [
    activeScanId,
    scanning,
    enriching,
    specimens.length,
    error,
    generateScanReport,
    speedOn,
  ]);

  const addImages = useCallback(
    (files: FileList | File[]) => {
      void addFiles(files);
    },
    [addFiles],
  );

  const removeImage = useCallback(
    (id: string) => {
      removeSlot(id);
    },
    [removeSlot],
  );

  const reorderImages = useCallback(
    (from: number, to: number) => {
      reorderSlots(from, to);
    },
    [reorderSlots],
  );

  const resetScan = useCallback(() => {
    clearSession();
    finalizedScanRef.current = null;
    reportScanRef.current = null;
    setActiveScanId(null);
    setLoadedSessionId(null);
    setMessages([WELCOME_ASSISTANT]);
    setPrompt("");
    setResultsDrawerOpen(false);
    setSaveStatus(null);
    clearScanLimit();
  }, [clearSession, clearScanLimit]);

  const handleConfirmCandidate = useCallback(
    (candidate: CatalogCandidate) => {
      if (!selectedSpecimenId) return;
      confirmCatalogCandidate(selectedSpecimenId, candidate);
    },
    [confirmCatalogCandidate, selectedSpecimenId],
  );

  const handleRejectCandidate = useCallback(
    (catalogId: string) => {
      if (!selectedSpecimenId) return;
      rejectCatalogCandidate(selectedSpecimenId, catalogId);
    },
    [rejectCatalogCandidate, selectedSpecimenId],
  );

  const handleUpdateSpecimen = useCallback(
    (patch: Partial<ExtractedCard>) => {
      if (!selectedSpecimenId) return;
      updateSpecimen(selectedSpecimenId, patch);
    },
    [selectedSpecimenId, updateSpecimen],
  );

  const handleCommitSpecimenEdit = useCallback(() => {
    if (!selectedSpecimenId) return;
    void flushManualEnrich(selectedSpecimenId);
  }, [flushManualEnrich, selectedSpecimenId]);

  const handleExcludeSpecimen = useCallback(
    (id: string) => {
      removeSpecimen(id);
      if (selectedSpecimenId === id) {
        const next = specimens.find((s) => s.id !== id);
        setSelectedSpecimenId(next?.id ?? null);
      }
    },
    [removeSpecimen, selectedSpecimenId, specimens, setSelectedSpecimenId],
  );

  const scrollToComps = useCallback(() => {
    compsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const persistSpecimens = useCallback(
    async (items: typeof specimens, title: string) => {
      if (items.length === 0 || saving) return false;
      setSaving(true);
      setSaveStatus(null);
      try {
        const response = await fetch("/api/saved/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            specimens: items.map((item) => ({
              card: item.card,
              context: item.context,
            })),
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          savedCount?: number;
        };
        if (!response.ok) throw new Error(payload.error ?? "Unable to save session");
        const count = payload.savedCount ?? items.length;
        setSaveStatus(`Saved ${count} card(s) to collection. FMV history will update for saved cards.`);
        setHistoryRefreshKey((k) => k + 1);
        return true;
      } catch (err) {
        setSaveStatus(err instanceof Error ? err.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  const saveToCollection = useCallback(async () => {
    await persistSpecimens(
      specimens,
      `PGT Liquid Scan ${new Date().toLocaleString()}`,
    );
  }, [persistSpecimens, specimens]);

  const saveSpecimenToCollection = useCallback(
    async (specimenId: string) => {
      const item = specimens.find((s) => s.id === specimenId);
      if (!item) return;
      const title = getCardDisplayTitle(item.card);
      await persistSpecimens([item], `PGT Liquid Scan · ${title}`);
    },
    [persistSpecimens, specimens],
  );

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        createdAt: Date.now(),
        text,
      },
    ]);
  }, []);

  const sendLiquidAsk = useCallback(
    async (text: string) => {
      if (isAsking || isScanning) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const history = chatHistoryFromMessages(messages);
      const userMsg: UserChatMessage = {
        id: uid(),
        role: "user",
        createdAt: Date.now(),
        text: trimmed,
        scanMode,
      };
      const assistantId = uid();

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "pending-ask"),
        userMsg,
        {
          id: "pending-ask",
          role: "assistant",
          createdAt: Date.now(),
          text: "",
          streaming: true,
          askResearch: null,
          askStatus: "Connecting…",
        },
      ]);
      setIsAsking(true);

      try {
        const response = await fetch("/api/scan/liquid-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            contexts: specimens.map((s) => s.context),
            focusSpecimenId: selectedSpecimenId,
          }),
        });

        let accumulated = "";
        const meta = await readLiquidChatSse(response, {
          onText: (chunk) => {
            accumulated += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === "pending-ask" && m.role === "assistant"
                  ? { ...m, text: accumulated, streaming: true, askStatus: null }
                  : m,
              ),
            );
          },
          onNotice: (notice) => {
            appendAssistantMessage(notice);
          },
          onStatus: (_phase, statusMsg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === "pending-ask" && m.role === "assistant"
                  ? { ...m, askStatus: statusMsg, streaming: true }
                  : m,
              ),
            );
          },
          onResearch: (research) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === "pending-ask" && m.role === "assistant"
                  ? { ...m, askResearch: research, streaming: true }
                  : m,
              ),
            );
          },
        });

        const finalText = accumulated.trim() || "No response from the model.";
        const research = meta.research ?? null;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === "pending-ask" && m.role === "assistant"
              ? {
                  ...m,
                  id: assistantId,
                  text: finalText,
                  streaming: false,
                  askResearch: research,
                  askProvider: meta.provider,
                  askStatus: null,
                }
              : m,
          ),
        );
      } catch (err) {
        const errText = err instanceof Error ? err.message : "Ask failed";
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "pending-ask"),
          {
            id: assistantId,
            role: "assistant",
            createdAt: Date.now(),
            text: errText,
          },
        ]);
      } finally {
        setIsAsking(false);
      }
    },
    [appendAssistantMessage, isAsking, isScanning, messages, scanMode, specimens, selectedSpecimenId],
  );

  const pushChatOutput = useCallback(
    (kind: ChatOutputKind, userText: string, assistantText: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "user",
          createdAt: Date.now(),
          text: userText,
        },
        {
          id: uid(),
          role: "assistant",
          createdAt: Date.now(),
          text: assistantText,
          output: { kind },
        },
      ]);
      setSidebarOpen(false);
    },
    [],
  );

  const dismissMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const openCatalogOutput = useCallback(() => {
    pushChatOutput(
      "catalog",
      "Open master catalog",
      "Browse Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, and more — pick a franchise tab, open a set, then **Scan this card** to load a confirmed catalog row into this session.",
    );
  }, [pushChatOutput]);

  const openCompanionOutput = useCallback(() => {
    pushChatOutput(
      "companion",
      "Open companion",
      "Your PGT companion is synced to your account. Feed, train, battle, and claim tasks while you scan and research cards.",
    );
  }, [pushChatOutput]);

  const loadCatalogPrefill = useCallback(
    async (prefill: CatalogScanPrefill) => {
      if (isBusy) return;
      const pendingId = "pending-catalog-load";
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "user",
          createdAt: Date.now(),
          text: `Load catalog card: ${prefill.name}`,
        },
        {
          id: pendingId,
          role: "assistant",
          createdAt: Date.now(),
          text: `Loading **${prefill.name}** from the master catalog…`,
          streaming: true,
        },
      ]);
      setResultsDrawerOpen(true);

      try {
        const loaded = await ingestCatalogPrefill(prefill);
        const scanSummary =
          loaded.length > 0 ? buildScanSummaryFromSpecimens(loaded) : null;
        const resultCards = loaded.map((s, i) => specimenToCardMatch(s, i));
        const text = `Loaded **${prefill.name}** from the catalog with market enrichment. Review comps and identity in the intelligence panel.`;

        setMessages((prev) =>
          prev
            .filter((m) => m.id !== pendingId)
            .concat({
              id: uid(),
              role: "assistant",
              createdAt: Date.now(),
              text,
              cards: resultCards.length > 0 ? resultCards : undefined,
              summary: scanSummary ?? undefined,
            }),
        );
      } catch (err) {
        const errText =
          err instanceof Error ? err.message : "Failed to load catalog card";
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== pendingId)
            .concat({
              id: uid(),
              role: "assistant",
              createdAt: Date.now(),
              text: errText,
            }),
        );
      }
    },
    [ingestCatalogPrefill, isBusy],
  );

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (loadingSession || isBusy) return;
      setLoadingSession(true);
      setLoadingSessionId(sessionId);
      setSaveStatus(null);
      try {
        const response = await fetch(`/api/saved/sessions/${encodeURIComponent(sessionId)}`);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          session?: { id: string; title: string; specimenCount: number };
          specimens?: Array<{ card: unknown; context?: unknown }>;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load scan session");
        }

        const restored = restoreSpecimensFromSaved(payload.specimens ?? []);
        if (restored.length === 0) {
          throw new Error("This session has no saved cards to restore.");
        }

        const marker = `saved:${sessionId}`;
        finalizedScanRef.current = marker;
        setActiveScanId(marker);
        setLoadedSessionId(sessionId);
        hydrateSavedSession(
          restored.map((item) => ({ card: item.card, context: item.context })),
        );

        const scanSummary = buildScanSummaryFromSpecimens(restored);
        const resultCards = restored.map((s, i) => specimenToCardMatch(s, i));
        const title = payload.session?.title?.trim() || "Saved scan";

        setMessages([
          WELCOME_ASSISTANT,
          {
            id: uid(),
            role: "assistant",
            createdAt: Date.now(),
            text: `Restored **${title}** (${restored.length} card${restored.length === 1 ? "" : "s"}) from your scan history. Tap a card to review comps, or ask a follow-up below.`,
            cards: resultCards,
            summary: scanSummary,
          },
        ]);
        setResultsDrawerOpen(true);
        setSidebarOpen(false);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error ? err.message : "Failed to load scan from history",
        );
      } finally {
        setLoadingSession(false);
        setLoadingSessionId(null);
      }
    },
    [appendAssistantMessage, hydrateSavedSession, isBusy, loadingSession],
  );

  const handlePromptChip = useCallback(
    async (chip: string) => {
      const lower = chip.toLowerCase();
      if (lower.includes("binder")) {
        setScanMode("binder");
        setPrompt("");
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            createdAt: Date.now(),
            text: "Binder mode selected. Upload one or more page photos, then tap Start AI Scan.",
          },
        ]);
        return;
      }
      if (lower.includes("graded")) {
        setScanMode("graded");
        setPrompt("");
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            createdAt: Date.now(),
            text: "Graded slab mode selected. Upload slab photos and run Start AI Scan.",
          },
        ]);
        return;
      }
      if (lower.includes("catalog") || lower.includes("pokedex") || lower.includes("master")) {
        openCatalogOutput();
        return;
      }
      if (lower.includes("companion")) {
        openCompanionOutput();
        return;
      }
      if (lower.includes("export") && lower.includes("csv")) {
        if (specimens.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              createdAt: Date.now(),
              text: "Run a scan first, then export CSV from the intelligence panel or sidebar.",
            },
          ]);
          return;
        }
        const { downloadSpecimensCsv } = await import("@/lib/scan/export");
        downloadSpecimensCsv(specimens);
        setSaveStatus("Exported session as CSV.");
        return;
      }
      if (specimens.length > 0) {
        await sendLiquidAsk(chip);
        return;
      }
      setPrompt(chip);
      await sendLiquidAsk(chip);
    },
    [openCatalogOutput, openCompanionOutput, sendLiquidAsk, specimens],
  );

  const runLiveScan = useCallback(async () => {
    if (isScanning) return;
    if (slots.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          createdAt: Date.now(),
          text: "Add at least one image before starting a scan.",
        },
      ]);
      return;
    }

    const scanId = uid();
    finalizedScanRef.current = null;
    setActiveScanId(scanId);
    setLoadedSessionId(null);

    const userMsg: UserChatMessage = {
      id: uid(),
      role: "user",
      createdAt: Date.now(),
      text: prompt.trim() || undefined,
      images: slotsToUploadedImages(slots),
      scanMode,
    };

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== "pending-result"),
      userMsg,
      {
        id: "pending-result",
        role: "assistant",
        createdAt: Date.now(),
        text: "Starting vision extraction…",
        streaming: true,
      },
    ]);
    setPrompt("");

    await runScan();
  }, [isScanning, prompt, scanMode, slots, runScan]);

  const runComposerSubmit = useCallback(async () => {
    if (isBusy) return;
    const trimmed = prompt.trim();

    if (slots.length > 0) {
      await runLiveScan();
      return;
    }

    if (!trimmed) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          createdAt: Date.now(),
          text: "Type a question about your scan, or upload images and tap Start AI Scan.",
        },
      ]);
      return;
    }

    setPrompt("");
    await sendLiquidAsk(trimmed);
  }, [isBusy, prompt, slots.length, runLiveScan, sendLiquidAsk]);

  return {
    messages,
    images,
    scanMode,
    setScanMode,
    prompt,
    setPrompt,
    isScanning,
    isAsking,
    isGeneratingReport,
    isBusy,
    scanning,
    enriching,
    progress,
    error,
    scanLimit,
    clearScanLimit,
    summary,
    cards,
    specimens,
    selectedSpecimen,
    selectedSpecimenId,
    setSelectedSpecimenId,
    enrichingSpecimenId,
    handleConfirmCandidate,
    handleRejectCandidate,
    handleExcludeSpecimen,
    scrollToComps,
    compsSectionRef,
    saveToCollection,
    saveSpecimenToCollection,
    saveStatus,
    saving,
    historyRefreshKey,
    sidebarOpen,
    setSidebarOpen,
    resultsDrawerOpen,
    setResultsDrawerOpen,
    addImages,
    removeImage,
    reorderImages,
    runLiveScan,
    runComposerSubmit,
    sendLiquidAsk,
    resetScan,
    loadSession,
    loadingSession,
    loadingSessionId,
    recentSessions,
    recentLoading,
    loadedSessionId,
    historyExpanded,
    setHistoryExpanded,
    refreshRecentSessions,
    dismissMessage,
    openCatalogOutput,
    openCompanionOutput,
    loadCatalogPrefill,
    rescanSpecimen,
    setUserEvidenceCrop,
    rescanningId,
    handleUpdateSpecimen,
    handleCommitSpecimenEdit,
    uploadQueuedCount,
    handlePromptChip,
    appendAssistantMessage,
    speedOn,
    setLiquidScanSpeedOn,
    laneMode,
    ingestLiveCameraScan,
  };
}
