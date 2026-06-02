"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readBinderTrackerSetPrefs,
  writeBinderTrackerSetPrefs,
} from "@/lib/catalog/binder-tracker-prefs";

export function useCatalogBinderTracker(setId: string, setCardCount: number) {
  const { isSignedIn, isLoaded } = useAuth();
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [trackerEnabled, setTrackerEnabledState] = useState(false);
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!setId) return;
    const prefs = readBinderTrackerSetPrefs(setId);
    setTrackerEnabledState(prefs.trackerEnabled);
  }, [setId]);

  const loadOwned = useCallback(async () => {
    if (!setId || !isSignedIn) {
      setOwnedIds(new Set());
      setEmail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/catalog/binder-tracker?setId=${encodeURIComponent(setId)}`,
        { credentials: "same-origin" },
      );
      const body = (await res.json()) as {
        ownedCatalogIds?: string[];
        email?: string | null;
        error?: string;
        setupHint?: string;
        code?: string;
      };
      if (!res.ok) {
        const hint = body.setupHint ? ` ${body.setupHint}` : "";
        throw new Error(`${body.error ?? `Load failed (${res.status})`}${hint}`);
      }
      setOwnedIds(new Set(body.ownedCatalogIds ?? []));
      setEmail(body.email ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, setId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (trackerEnabled && !isSignedIn) {
      setTrackerEnabledState(false);
      if (setId) {
        writeBinderTrackerSetPrefs(setId, { trackerEnabled: false });
      }
      return;
    }
    if (!trackerEnabled || !isSignedIn) {
      if (!trackerEnabled) setOwnedIds(new Set());
      return;
    }
    void loadOwned();
  }, [isLoaded, isSignedIn, trackerEnabled, loadOwned, setId]);

  const flushPending = useCallback(async () => {
    if (!setId || !isSignedIn || pendingRef.current.size === 0) return;
    const batch = new Map(pendingRef.current);
    pendingRef.current.clear();
    setSaving(true);
    setError(null);
    try {
      for (const [catalogId, owned] of batch) {
        const res = await fetch("/api/catalog/binder-tracker", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setId, catalogId, owned }),
        });
        const body = (await res.json()) as {
          ownedCatalogIds?: string[];
          email?: string | null;
          error?: string;
          setupHint?: string;
        };
        if (!res.ok) {
          const hint = body.setupHint ? ` ${body.setupHint}` : "";
          throw new Error(`${body.error ?? `Save failed (${res.status})}`}${hint}`);
        }
        if (body.ownedCatalogIds) {
          setOwnedIds(new Set(body.ownedCatalogIds));
        }
        if (body.email) setEmail(body.email);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      void loadOwned();
    } finally {
      setSaving(false);
    }
  }, [isSignedIn, loadOwned, setId]);

  const queueSave = useCallback(
    (catalogId: string, owned: boolean) => {
      pendingRef.current.set(catalogId, owned);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void flushPending();
      }, 280);
    },
    [flushPending],
  );

  const setTrackerEnabled = useCallback(
    (next: boolean) => {
      if (next && isLoaded && !isSignedIn) return false;
      setTrackerEnabledState(next);
      if (setId) writeBinderTrackerSetPrefs(setId, { trackerEnabled: next });
      return true;
    },
    [isLoaded, isSignedIn, setId],
  );

  const toggleOwned = useCallback(
    (catalogId: string) => {
      if (!trackerEnabled || !isSignedIn) return;
      const owned = !ownedIds.has(catalogId);
      setOwnedIds((prev) => {
        const next = new Set(prev);
        if (owned) next.add(catalogId);
        else next.delete(catalogId);
        return next;
      });
      queueSave(catalogId, owned);
    },
    [isSignedIn, ownedIds, queueSave, trackerEnabled],
  );

  const ownedCount = ownedIds.size;
  const progressLabel =
    setCardCount > 0 ? `${ownedCount} / ${setCardCount} owned` : `${ownedCount} owned`;

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    email,
    ownedIds,
    ownedCount,
    progressLabel,
    loading,
    saving,
    error,
    trackerEnabled,
    setTrackerEnabled,
    toggleOwned,
    isOwned: (catalogId: string) => ownedIds.has(catalogId),
  };
}
