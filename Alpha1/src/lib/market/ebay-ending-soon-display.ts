export type EbayAuctionTimeLeft = {
  /** Human duration, e.g. `14m 08s` or `2h 05m 03s`. */
  primary: string;
  /** Local wall-clock end, e.g. `Ends 3:42:15 PM`. */
  endsAtLabel: string;
  ended: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Countdown + exact local end time for ending-soon auction rows. */
export function formatEbayAuctionTimeLeft(
  endsAt: string,
  nowMs: number,
): EbayAuctionTimeLeft {
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(endMs)) {
    return { primary: "—", endsAtLabel: "End time unknown", ended: false };
  }

  const endsAtLabel = `Ends ${new Date(endMs).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })}`;

  const diff = endMs - nowMs;
  if (diff <= 0) {
    return { primary: "Ended", endsAtLabel, ended: true };
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  let primary: string;
  if (days > 0) {
    primary = `${days}d ${hours}h ${mins}m`;
  } else if (hours > 0) {
    primary = `${hours}h ${mins}m ${pad2(secs)}s`;
  } else if (mins > 0) {
    primary = `${mins}m ${pad2(secs)}s`;
  } else {
    primary = `${secs}s`;
  }

  return { primary, endsAtLabel, ended: false };
}

export function ebayAuctionUrgencyClass(endsAt: string, nowMs: number): string {
  const diff = Date.parse(endsAt) - nowMs;
  if (diff <= 0) return "text-slate-500";
  if (diff < 15 * 60 * 1000) return "text-rose-300";
  if (diff < 60 * 60 * 1000) return "text-amber-300";
  return "text-violet-200";
}
