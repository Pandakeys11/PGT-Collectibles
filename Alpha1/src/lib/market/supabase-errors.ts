/** True when Supabase/PostgREST reports a missing table or relation. */
export function isMissingRelationError(error: {
  message?: string;
  code?: string;
}): boolean {
  const code = error.code?.toLowerCase();
  if (code === "42p01" || code === "pgrst205") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}
