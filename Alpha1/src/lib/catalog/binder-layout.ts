/** 3×5 pocket grid — one physical binder page (15 slots). */
export const BINDER_COLS = 3;
export const BINDER_ROWS = 5;
export const BINDER_SLOTS_PER_PAGE = BINDER_COLS * BINDER_ROWS;

/** Open spread: left page + right page (30 slots). */
export const BINDER_SLOTS_PER_SPREAD = BINDER_SLOTS_PER_PAGE * 2;

export function binderSpreadCount(slotCount: number): number {
  if (slotCount <= 0) return 0;
  return Math.ceil(slotCount / BINDER_SLOTS_PER_SPREAD);
}

export function binderPageCount(slotCount: number): number {
  if (slotCount <= 0) return 0;
  return Math.ceil(slotCount / BINDER_SLOTS_PER_PAGE);
}

/** Pad to full spreads so the last open book page is never half-empty visually. */
export function padToBinderSpreads<T>(items: T[]): (T | null)[] {
  const spreadCount = Math.max(1, binderSpreadCount(items.length));
  const total = spreadCount * BINDER_SLOTS_PER_SPREAD;
  const out: (T | null)[] = items.map((x) => x);
  while (out.length < total) out.push(null);
  return out;
}

export function sliceBinderSpread<T>(
  padded: readonly (T | null)[],
  spreadIndex: number,
): { left: (T | null)[]; right: (T | null)[] } {
  const start = spreadIndex * BINDER_SLOTS_PER_SPREAD;
  const chunk = padded.slice(start, start + BINDER_SLOTS_PER_SPREAD);
  return {
    left: chunk.slice(0, BINDER_SLOTS_PER_PAGE),
    right: chunk.slice(BINDER_SLOTS_PER_PAGE, BINDER_SLOTS_PER_SPREAD),
  };
}

export function sliceBinderPage<T>(
  padded: readonly (T | null)[],
  pageIndex: number,
): (T | null)[] {
  const start = pageIndex * BINDER_SLOTS_PER_PAGE;
  return padded.slice(start, start + BINDER_SLOTS_PER_PAGE);
}

export function binderSpreadLabel(spreadIndex: number, spreadTotal: number): string {
  return `Spread ${spreadIndex + 1} / ${Math.max(1, spreadTotal)}`;
}

export function binderPageLabel(pageIndex: number, pageTotal: number): string {
  return `Page ${pageIndex + 1} / ${Math.max(1, pageTotal)}`;
}
