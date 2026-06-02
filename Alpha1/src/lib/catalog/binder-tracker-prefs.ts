const STORAGE_KEY = "pgt.binder-tracker.prefs.v1";

export type BinderTrackerSetPrefs = {
  trackerEnabled: boolean;
};

type BinderTrackerPrefsStore = {
  sets: Record<string, BinderTrackerSetPrefs>;
};

function readStore(): BinderTrackerPrefsStore {
  if (typeof window === "undefined") return { sets: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sets: {} };
    const parsed = JSON.parse(raw) as BinderTrackerPrefsStore;
    if (!parsed || typeof parsed !== "object" || !parsed.sets) return { sets: {} };
    return parsed;
  } catch {
    return { sets: {} };
  }
}

function writeStore(store: BinderTrackerPrefsStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readBinderTrackerSetPrefs(setId: string): BinderTrackerSetPrefs {
  const store = readStore();
  return (
    store.sets[setId] ?? {
      trackerEnabled: false,
    }
  );
}

export function writeBinderTrackerSetPrefs(
  setId: string,
  patch: Partial<BinderTrackerSetPrefs>,
): BinderTrackerSetPrefs {
  const store = readStore();
  const next: BinderTrackerSetPrefs = {
    ...readBinderTrackerSetPrefs(setId),
    ...patch,
  };
  store.sets[setId] = next;
  writeStore(store);
  return next;
}
