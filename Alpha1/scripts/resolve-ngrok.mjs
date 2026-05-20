import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const WINGET_NGROK = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Microsoft",
  "WinGet",
  "Packages",
  "Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe",
  "ngrok.exe",
);

/** Resolve ngrok executable (PATH or common Windows install locations). */
export function resolveNgrokExecutable() {
  const fromEnv = process.env.NGROK_BIN?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  if (fs.existsSync(WINGET_NGROK)) return WINGET_NGROK;

  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ngrok"], {
    encoding: "utf8",
    shell: true,
  });
  if (which.status === 0) {
    const line = which.stdout.split(/\r?\n/).find((l) => l.trim())?.trim();
    if (line && fs.existsSync(line)) return line;
  }

  return "ngrok";
}
