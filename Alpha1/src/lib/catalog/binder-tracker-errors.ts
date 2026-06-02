import { isMissingRelationError } from "@/lib/market/supabase-errors";

export const BINDER_TRACKER_TABLE = "catalog_binder_owned_cards";

export function isBinderTrackerTableMissingError(message: string, code?: string): boolean {
  if (isMissingRelationError({ message, code })) return true;
  const m = message.toLowerCase();
  return m.includes(BINDER_TRACKER_TABLE) && m.includes("schema cache");
}

export const BINDER_TRACKER_SETUP_HINT =
  "Run database migration: npm run db:apply:binder-tracker (or npm run db:apply) from the Alpha1 folder.";

export function formatBinderTrackerError(err: unknown): {
  message: string;
  code?: "TABLE_NOT_READY";
  setupHint?: string;
} {
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "Binder tracker error";
  const pgCode =
    err && typeof err === "object" && "code" in err && typeof err.code === "string"
      ? err.code
      : undefined;
  if (isBinderTrackerTableMissingError(message, pgCode)) {
    return {
      message: "Binder tracker database table is not installed yet.",
      code: "TABLE_NOT_READY",
      setupHint: BINDER_TRACKER_SETUP_HINT,
    };
  }
  return { message };
}
