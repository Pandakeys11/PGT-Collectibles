/** Sole master admin — unlimited scans and full access. Case-insensitive match. */
export const MASTER_ADMIN_EMAIL = "solarverse2022@gmail.com";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === MASTER_ADMIN_EMAIL;
}
