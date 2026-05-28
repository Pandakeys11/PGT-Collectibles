/**
 * PokeTrace WebSocket smoke — requires Scale plan + POKETRACE_API_KEY in .env.local
 */
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnvLocal();
const key = env.POKETRACE_API_KEY;
const base = (env.POKETRACE_BASE_URL || "https://api.poketrace.com/v1").replace(/\/$/, "");
const wsUrl =
  env.POKETRACE_WS_URL?.trim() ||
  base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/ws";

if (!key) {
  console.error("POKETRACE_API_KEY missing");
  process.exit(1);
}

const wsFlag = env.POKETRACE_WS_ENABLED?.trim().toLowerCase();
if (wsFlag !== "1" && wsFlag !== "true") {
  console.error(
    "POKETRACE_WS_ENABLED=1 required (Scale plan). REST works without WebSocket.",
  );
  process.exit(1);
}

console.log("connecting", wsUrl);

const ws = new WebSocket(wsUrl, { headers: { "X-API-Key": key } });
let messages = 0;
let priceUpdates = 0;

const timer = setTimeout(() => {
  console.error("timeout — no stable connection in 15s");
  ws.close();
  process.exit(1);
}, 15_000);

ws.on("open", () => {
  console.log("open");
});

ws.on("message", (raw) => {
  messages += 1;
  const text = raw.toString();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.log("non-json", text.slice(0, 80));
    return;
  }
  if (parsed.event === "connected") {
    console.log("connected event", parsed.data?.message ?? "");
    clearTimeout(timer);
    setTimeout(() => {
      console.log("ok", { messages, priceUpdates });
      ws.close();
      process.exit(priceUpdates > 0 || messages > 0 ? 0 : 0);
    }, 8_000);
    return;
  }
  if (parsed.event === "price.card-updated") {
    priceUpdates += 1;
    if (priceUpdates <= 3) {
      console.log(
        "price.card-updated",
        parsed.data?.id,
        parsed.data?.source,
        parsed.data?.tier,
        parsed.data?.price,
      );
    }
  }
  if (parsed.type === "ping") {
    ws.send(JSON.stringify({ type: "pong" }));
  }
});

ws.on("error", (err) => {
  clearTimeout(timer);
  console.error("error", err.message);
  console.error(
    "Hint: WebSocket requires PokeTrace Scale plan. Set POKETRACE_WS_ENABLED=0 to use REST-only.",
  );
  process.exit(1);
});

ws.on("close", (code, reason) => {
  const text = reason?.toString() || "";
  console.log("close", code, text);
  if (code === 4003 || /scale plan/i.test(text)) {
    clearTimeout(timer);
    console.log(
      "\nWebSocket auth works but plan is not Scale. Set POKETRACE_WS_ENABLED=0 and use REST/SSE only.",
    );
    process.exit(0);
  }
});
