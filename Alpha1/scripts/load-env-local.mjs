import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Load Alpha1/.env.local into process.env (does not override existing vars). */
export function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return false;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Prefer .env.local when it has a value (shell may export empty placeholders)
    if (value !== "" || process.env[key] == null) {
      process.env[key] = value;
    }
  }
  return true;
}
