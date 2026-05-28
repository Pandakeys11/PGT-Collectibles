"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  lerpCatalogAmbientPalette,
  OBSIDIAN_AMBIENT,
  resolveCatalogAmbientPalette,
  type CatalogAmbientPalette,
  type CatalogAmbientSource,
} from "@/lib/ui/catalog-ambient-palette";
import {
  applyCatalogAmbientPalette,
  resetCatalogAmbientPalette,
} from "@/lib/ui/catalog-ambient-runtime";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const CYCLE_MS = 16_000;
const TRANSITION_MS = 2_600;
const HOVER_HOLD_MS = 400;

type CatalogAmbientContextValue = {
  registerSets: (sources: CatalogAmbientSource[]) => void;
  setHoverSet: (source: CatalogAmbientSource | null) => void;
  setFocusSetId: (setId: string | null) => void;
};

const CatalogAmbientContext = createContext<CatalogAmbientContextValue | null>(null);

export function useCatalogAmbient(): CatalogAmbientContextValue {
  const ctx = useContext(CatalogAmbientContext);
  if (!ctx) {
    throw new Error("useCatalogAmbient must be used within CatalogAmbientProvider");
  }
  return ctx;
}

export function useCatalogAmbientOptional(): CatalogAmbientContextValue | null {
  return useContext(CatalogAmbientContext);
}

export function CatalogAmbientProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const sourcesRef = useRef<CatalogAmbientSource[]>([]);
  const paletteByIdRef = useRef<Map<string, CatalogAmbientPalette>>(new Map());
  const displayedRef = useRef<CatalogAmbientPalette>(OBSIDIAN_AMBIENT);
  const targetRef = useRef<CatalogAmbientPalette>(OBSIDIAN_AMBIENT);
  const transitionStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const cycleIndexRef = useRef(0);
  const hoverIdRef = useRef<string | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourcesVersion, setSourcesVersion] = useState(0);

  const ensurePalette = useCallback(async (source: CatalogAmbientSource) => {
    const existing = paletteByIdRef.current.get(source.id);
    if (existing) return existing;
    const palette = await resolveCatalogAmbientPalette(source);
    paletteByIdRef.current.set(source.id, palette);
    return palette;
  }, []);

  const beginTransitionTo = useCallback(
    (palette: CatalogAmbientPalette) => {
      if (reducedMotion) {
        displayedRef.current = palette;
        targetRef.current = palette;
        transitionStartRef.current = null;
        applyCatalogAmbientPalette(palette);
        return;
      }
      targetRef.current = palette;
      transitionStartRef.current = performance.now();
    },
    [reducedMotion],
  );

  const goToSet = useCallback(
    async (setId: string) => {
      const source = sourcesRef.current.find((s) => s.id === setId);
      if (!source) {
        beginTransitionTo(OBSIDIAN_AMBIENT);
        return;
      }
      const palette = await ensurePalette(source);
      beginTransitionTo(palette);
    },
    [beginTransitionTo, ensurePalette],
  );

  const registerSets = useCallback((sources: CatalogAmbientSource[]) => {
    sourcesRef.current = sources;
    setSourcesVersion((v) => v + 1);
    void Promise.all(sources.slice(0, 24).map((s) => ensurePalette(s))).catch(() => undefined);
  }, [ensurePalette]);

  const setHoverSet = useCallback(
    (source: CatalogAmbientSource | null) => {
      if (hoverClearTimerRef.current) {
        clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      if (!source) {
        hoverClearTimerRef.current = setTimeout(() => {
          hoverIdRef.current = null;
          const focus = focusIdRef.current;
          if (focus) void goToSet(focus);
          else if (sourcesRef.current.length) {
            const idx = cycleIndexRef.current % sourcesRef.current.length;
            void goToSet(sourcesRef.current[idx]!.id);
          } else {
            beginTransitionTo(OBSIDIAN_AMBIENT);
          }
        }, HOVER_HOLD_MS);
        return;
      }
      hoverIdRef.current = source.id;
      void ensurePalette(source).then((palette) => {
        if (hoverIdRef.current === source.id) beginTransitionTo(palette);
      });
    },
    [beginTransitionTo, ensurePalette, goToSet],
  );

  const setFocusSetId = useCallback(
    (setId: string | null) => {
      focusIdRef.current = setId;
      if (hoverIdRef.current) return;
      if (setId) void goToSet(setId);
    },
    [goToSet],
  );

  const value = useMemo(
    () => ({ registerSets, setHoverSet, setFocusSetId }),
    [registerSets, setHoverSet, setFocusSetId],
  );

  useEffect(() => {
    resetCatalogAmbientPalette();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (hoverClearTimerRef.current) clearTimeout(hoverClearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const list = sourcesRef.current;
    if (!list.length || hoverIdRef.current) return;
    void goToSet(list[0]!.id);
  }, [goToSet, sourcesVersion]);

  useEffect(() => {
    if (reducedMotion || hoverIdRef.current || sourcesRef.current.length === 0) return undefined;

    const timer = setInterval(() => {
      if (hoverIdRef.current) return;
      const list = sourcesRef.current;
      if (!list.length) return;
      cycleIndexRef.current = (cycleIndexRef.current + 1) % list.length;
      void goToSet(list[cycleIndexRef.current]!.id);
    }, CYCLE_MS);

    return () => clearInterval(timer);
  }, [goToSet, reducedMotion, sourcesVersion]);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const tick = (now: number) => {
      const start = transitionStartRef.current;
      if (start != null) {
        const t = Math.min(1, (now - start) / TRANSITION_MS);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const blended = lerpCatalogAmbientPalette(displayedRef.current, targetRef.current, eased);
        applyCatalogAmbientPalette(blended);
        if (t >= 1) {
          displayedRef.current = targetRef.current;
          transitionStartRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  return (
    <CatalogAmbientContext.Provider value={value}>{children}</CatalogAmbientContext.Provider>
  );
}
