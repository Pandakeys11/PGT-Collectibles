"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  Calculator,
  CreditCard,
  Download,
  History,
  Loader2,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BrandLogo } from "@/components/branding/brand-logo";
import { ScannerThemeStrip } from "@/components/shell/scanner-theme-strip";
import type { ScanHistoryItem } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export type SidebarNavId =
  | "new"
  | "calculator"
  | "catalog"
  | "companion"
  | "history"
  | "collections"
  | "watchlist"
  | "exports"
  | "billing";

const NAV: {
  id: SidebarNavId;
  label: string;
  icon: typeof Plus;
  href?: string;
}[] = [
  { id: "new", label: "New Scan", icon: Plus },
  { id: "calculator", label: "Deal calculator", icon: Calculator },
  { id: "catalog", label: "Master catalog", icon: BookOpen },
  { id: "companion", label: "Companion", icon: Sparkles },
  { id: "history", label: "Recent scans", icon: History },
  { id: "collections", label: "Saved Collections", icon: Bookmark, href: "/saved" },
  { id: "watchlist", label: "Watchlist", icon: Star },
  { id: "exports", label: "Export CSV", icon: Download },
  { id: "billing", label: "Billing / Plan", icon: CreditCard, href: "/usage" },
];

function formatHistoryWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RecentScansList({
  sessions,
  loading,
  activeSessionId,
  loadingSessionId,
  onSelect,
  onDelete,
  onClearAll,
  clearing,
}: {
  sessions: ScanHistoryItem[];
  loading: boolean;
  activeSessionId: string | null;
  loadingSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClearAll: () => void;
  clearing?: boolean;
}) {
  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading history…
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        Tap <span className="text-slate-400">Save scan</span> in results to store this session. Cards,
        comps, and FMV restore when you reopen it here.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end px-2">
        <button
          type="button"
          disabled={clearing}
          onClick={onClearAll}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
        >
          {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Clear all
        </button>
      </div>
      <ul className="max-h-52 space-y-0.5 overflow-y-auto px-1.5 scanner-chat-scrollbar">
        {sessions.map((item) => {
          const active = activeSessionId === item.id;
          const busy = loadingSessionId === item.id;
          return (
            <li key={item.id} className="group flex items-stretch gap-0.5">
              <button
                type="button"
                disabled={Boolean(loadingSessionId)}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "min-w-0 flex-1 flex-col rounded-lg px-2.5 py-2 text-left transition",
                  active
                    ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/25"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  busy && "opacity-70",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">{item.title}</span>
                  {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-600">
                  {item.cardCount} card{item.cardCount === 1 ? "" : "s"} ·{" "}
                  {formatHistoryWhen(item.timestamp)}
                </span>
              </button>
              <button
                type="button"
                disabled={Boolean(loadingSessionId) || clearing}
                onClick={() => onDelete(item.id)}
                className="flex w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarContent({
  onNewScan,
  onNav,
  canExport,
  recentSessions,
  recentLoading,
  activeSessionId,
  loadingSessionId,
  historyExpanded,
  onToggleHistory,
  onLoadSession,
  onDeleteSession,
  onClearRecentSessions,
  clearingHistory,
  onSaveScan,
  canSaveScan,
  savingScan,
  themeStripCompact = false,
  onClose,
}: {
  onNewScan: () => void;
  onNav: (id: SidebarNavId) => void;
  canExport: boolean;
  recentSessions: ScanHistoryItem[];
  recentLoading: boolean;
  activeSessionId: string | null;
  loadingSessionId: string | null;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearRecentSessions: () => void;
  clearingHistory?: boolean;
  onSaveScan?: () => void;
  canSaveScan?: boolean;
  savingScan?: boolean;
  themeStripCompact?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-4">
        <BrandLogo variant="icon-only" href={null} className="h-8 w-auto" showTagline={false} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">PGT Collectibles</p>
          <p className="text-[10px] text-muted">Liquid Scan</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-primary touch-manipulation"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const disabled = item.id === "exports" && !canExport;
          const className = cn(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition",
            item.id === "new"
              ? "bg-emerald-500/12 text-emerald-100"
              : disabled
                ? "cursor-not-allowed text-slate-600 opacity-50"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
          );

          if (item.id === "history") {
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleHistory}
                  className={cn(className, historyExpanded && "bg-white/[0.04] text-slate-200")}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 opacity-60 transition",
                      historyExpanded && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {historyExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <RecentScansList
                        sessions={recentSessions}
                        loading={recentLoading}
                        activeSessionId={activeSessionId}
                        loadingSessionId={loadingSessionId}
                        onSelect={onLoadSession}
                        onDelete={onDeleteSession}
                        onClearAll={onClearRecentSessions}
                        clearing={clearingHistory}
                      />
                      {canSaveScan && onSaveScan ? (
                        <button
                          type="button"
                          disabled={savingScan}
                          onClick={onSaveScan}
                          className="mx-2 mt-2 flex w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 py-2 text-[11px] font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
                        >
                          {savingScan ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                          {savingScan ? "Saving…" : "Save current scan"}
                        </button>
                      ) : null}
                      <Link
                        href="/saved"
                        className="mx-2 mb-1 mt-1 block rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                      >
                        View all saved cards →
                      </Link>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          }

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={className}>
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (item.id === "new") onNewScan();
                else onNav(item.id);
              }}
              className={className}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/6 p-3">
        <ScannerThemeStrip compact={themeStripCompact} />
        {!themeStripCompact ? (
          <p className="mt-3 px-1 text-[10px] leading-relaxed text-faint lg:hidden">
            Save scans to reopen from Recent scans. Adjust crop when source images are still loaded.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ScannerSidebar({
  mobileOpen,
  onMobileClose,
  onNewScan,
  onNav,
  canExport,
  recentSessions,
  recentLoading,
  activeSessionId,
  loadingSessionId,
  historyExpanded,
  onToggleHistory,
  onLoadSession,
  onDeleteSession,
  onClearRecentSessions,
  clearingHistory,
  onSaveScan,
  canSaveScan,
  savingScan,
  className,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onNewScan: () => void;
  onNav: (id: SidebarNavId) => void;
  canExport: boolean;
  recentSessions: ScanHistoryItem[];
  recentLoading: boolean;
  activeSessionId: string | null;
  loadingSessionId: string | null;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearRecentSessions: () => void;
  clearingHistory?: boolean;
  onSaveScan?: () => void;
  canSaveScan?: boolean;
  savingScan?: boolean;
  className?: string;
}) {
  const sidebarProps = {
    onNewScan,
    onNav,
    canExport,
    recentSessions,
    recentLoading,
    activeSessionId,
    loadingSessionId,
    historyExpanded,
    onToggleHistory,
    onLoadSession,
    onDeleteSession,
    onClearRecentSessions,
    clearingHistory,
    onSaveScan,
    canSaveScan,
    savingScan,
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const mobileDrawer =
    typeof document !== "undefined" ? (
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-[201] flex w-[min(280px,85vw)] max-w-[85vw] flex-col sc-glass pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] lg:hidden"
            >
              <SidebarContent
                {...sidebarProps}
                onClose={onMobileClose}
                onNewScan={() => {
                  onNewScan();
                  onMobileClose();
                }}
                onLoadSession={(id) => {
                  onLoadSession(id);
                  onMobileClose();
                }}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    ) : null;

  return (
    <>
      <aside
        className={cn(
          "hidden w-[260px] shrink-0 border-r border-white/6 sc-glass lg:flex lg:flex-col",
          className,
        )}
      >
        <SidebarContent {...sidebarProps} themeStripCompact />
      </aside>
      {mobileDrawer ? createPortal(mobileDrawer, document.body) : null}
    </>
  );
}
