"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import type { CompanionPersisted } from "@/lib/companion/game-engine";
import { toCompanionState } from "@/lib/companion/game-engine";
import {
  companionFromApiPayload,
  getLocalCompanion,
  pushLocalCompanionToServer,
} from "@/lib/companion/client-sync";
import type { CompanionActionId, CompanionState } from "@/lib/companion/schemas";
import { readResponseJson } from "@/lib/http/read-response-json";

type ApiPayload = {
  state: CompanionState;
  databaseConfigured: boolean;
  signedIn: boolean;
  companion?: CompanionPersisted;
};

export function useCompanion() {
  const { isSignedIn, userId } = useAuth();
  const [state, setState] = useState<CompanionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [databaseConfigured, setDatabaseConfigured] = useState(false);

  const applyPayload = useCallback((payload: ApiPayload) => {
    setDatabaseConfigured(payload.databaseConfigured);
    setState(payload.state);
    if (userId && payload.companion) {
      companionFromApiPayload(userId, payload);
    } else if (userId && payload.state.hatched) {
      companionFromApiPayload(userId, { state: payload.state });
    }
  }, [userId]);

  const getSnapshot = useCallback((): CompanionPersisted | null => {
    if (!userId) return null;
    return getLocalCompanion(userId);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const localRow = getLocalCompanion(userId);
      if (localRow) {
        await pushLocalCompanionToServer(userId, localRow);
      }

      const res = await fetch("/api/companion", { credentials: "include" });
      const payload = await readResponseJson<ApiPayload & { error?: string }>(res);
      if (!res.ok) {
        if (localRow) {
          setState(toCompanionState(localRow, "local"));
          setDatabaseConfigured(Boolean(payload.databaseConfigured));
        } else {
          setError(payload.error ?? `Failed to load companion (${res.status})`);
        }
        return;
      }

      if (!payload.state.hatched && localRow) {
        applyPayload({ ...payload, state: toCompanionState(localRow, "local"), companion: localRow });
        return;
      }

      applyPayload(payload);
    } catch (err) {
      const localRow = userId ? getLocalCompanion(userId) : null;
      if (localRow) {
        setState(toCompanionState(localRow, "local"));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload, isSignedIn, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, isSignedIn]);

  const hatch = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setError("Sign in to hatch your partner");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/companion/hatch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await readResponseJson<
        ApiPayload & {
          error?: string;
          hint?: string;
          reveal?: { id: number; name: string; slug: string };
          companion?: CompanionPersisted;
        }
      >(res);
      if (!res.ok) {
        setError(data.error ?? data.hint ?? `Hatch failed (${res.status})`);
        return null;
      }
      if (!data.state?.hatched) {
        setError("Hatch succeeded but partner data was missing — try Refresh.");
        return null;
      }
      applyPayload(data);
      const hatchedRow = data.companion ?? getLocalCompanion(userId);
      if (hatchedRow) await pushLocalCompanionToServer(userId, hatchedRow);

      if (!data.state.pokemonId || !data.state.pokemonName || !data.state.pokemonSlug) return null;
      return {
        id: data.state.pokemonId,
        name: data.state.pokemonName,
        slug: data.state.pokemonSlug,
        era: data.state.pokemonEra ?? "",
        tier: data.state.pokemonTier ?? "",
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [applyPayload, isSignedIn, userId]);

  const runAction = useCallback(
    async (action: CompanionActionId) => {
      if (!isSignedIn || !userId) {
        setError("Sign in required");
        return;
      }
      const snapshot = getSnapshot();
      if (!snapshot) {
        setError("Hatch a partner first");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/companion/action", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, companion: snapshot }),
        });
        const data = await readResponseJson<ApiPayload & { error?: string }>(res);
        if (!res.ok) {
          setError(data.error ?? `Action failed (${res.status})`);
          return;
        }
        if (!data.state) {
          setError("Invalid action response");
          return;
        }
        applyPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, getSnapshot, isSignedIn, userId],
  );

  const claimTask = useCallback(
    async (taskId: string) => {
      if (!isSignedIn || !userId) {
        setError("Sign in required");
        return;
      }
      const snapshot = getSnapshot();
      if (!snapshot) {
        setError("Hatch a partner first");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/companion/tasks/claim", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, companion: snapshot }),
        });
        const data = await readResponseJson<ApiPayload & { error?: string; rewardXp?: number }>(res);
        if (!res.ok) {
          setError(data.error ?? `Claim failed (${res.status})`);
          return;
        }
        if (!data.state) {
          setError("Invalid claim response");
          return;
        }
        applyPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, getSnapshot, isSignedIn, userId],
  );

  return {
    state,
    loading,
    busy,
    error,
    isSignedIn: Boolean(isSignedIn),
    databaseConfigured,
    refresh,
    hatch,
    runAction,
    claimTask,
    setError,
  };
}

export type CompanionController = ReturnType<typeof useCompanion>;
