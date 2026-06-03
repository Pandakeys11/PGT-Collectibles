/** UTC hour (0–23) when the daily TCG desk edition rolls forward. Default 11 = 06:00 EST. */
export function getMarketDailyBriefRefreshHourUtc(): number {
  const raw = Number(process.env.MARKET_DAILY_BRIEF_REFRESH_HOUR_UTC);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 23) return Math.floor(raw);
  return 11;
}

/** Minute past the refresh hour when Vercel cron pre-builds the desk (default 20). */
export function getMarketDailyBriefCronMinuteUtc(): number {
  const raw = Number(process.env.MARKET_DAILY_BRIEF_CRON_MINUTE_UTC);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 59) return Math.floor(raw);
  return 20;
}

/**
 * Desk edition date (YYYY-MM-DD). Before the refresh hour UTC, still shows yesterday's edition.
 */
export function getMarketDailyBriefEditionKey(now = new Date()): string {
  const hour = getMarketDailyBriefRefreshHourUtc();
  const d = new Date(now);
  if (d.getUTCHours() < hour) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/** ISO timestamp when the next edition becomes active (refresh hour UTC, :00). */
export function getMarketDailyBriefNextRefreshAt(now = new Date()): string {
  const hour = getMarketDailyBriefRefreshHourUtc();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0),
  );
  if (now.getTime() >= next.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

export function marketDailyBriefScheduleLabel(): string {
  const hour = getMarketDailyBriefRefreshHourUtc();
  const minute = getMarketDailyBriefCronMinuteUtc();
  const estHour = hour - 5;
  const estLabel =
    estHour >= 0
      ? `${String(estHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} EST`
      : `${String(24 + estHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} EST (prev day)`;
  return `${estLabel} (${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC cron pre-build)`;
}
