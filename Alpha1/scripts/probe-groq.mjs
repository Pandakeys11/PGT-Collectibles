/**
 * Quick Groq paid-setup probe (no Next.js / Clerk required).
 *
 * Usage:
 *   node scripts/probe-groq.mjs
 *   node scripts/probe-groq.mjs --vision
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

// Stale terminal exports can mask .env.local (e.g. GROQ_API_KEY=PASTE from an old session).
if (
  process.env.GROQ_API_KEY?.includes("PASTE") &&
  !readFileSync(join(process.cwd(), ".env.local"), "utf8")
    .split(/\r?\n/)
    .some((line) => line.startsWith("GROQ_API_KEY=") && line.includes("gsk_"))
) {
  delete process.env.GROQ_API_KEY;
  loadEnvLocal();
}

const runVision = process.argv.includes("--vision");
const key = process.env.GROQ_API_KEY?.trim() ?? "";
const textModel = process.env.GROQ_TEXT_MODEL?.trim() || "llama-3.1-8b-instant";
const visionModel =
  process.env.GROQ_VISION_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
const groqOnly = process.env.GROQ_PRIMARY_ONLY?.trim() === "1";

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

console.log("\n=== PGT Groq probe ===\n");

if (!key || key.includes("PASTE_YOUR") || key.length < 20) {
  fail(
    "GROQ_API_KEY missing or placeholder in .env.local — paste your rotated key (no quotes), then re-run.",
  );
}
ok(`API key present (${key.slice(0, 8)}…${key.slice(-4)})`);
console.log(`  GROQ_PRIMARY_ONLY=${groqOnly ? "1" : "0"}`);
console.log(`  Text model: ${textModel}`);
console.log(`  Vision model: ${visionModel}`);

const baseUrl = "https://api.groq.com/openai/v1";

async function groqChat(body) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { res, text, json };
}

console.log("\n--- Text test (tiny) ---");
const t0 = Date.now();
const textBody = {
  model: textModel,
  messages: [
    {
      role: "user",
      content:
        'Reply with exactly this JSON: {"ok":true,"provider":"groq","note":"paid text works"}',
    },
  ],
  max_tokens: 80,
  temperature: 0,
};
const textHit = await groqChat(textBody);
const textMs = Date.now() - t0;

if (!textHit.res.ok) {
  console.error("  HTTP", textHit.res.status, textHit.text.slice(0, 400));
  fail("Groq text API failed — check key, model allowlist, and billing.");
}

const content = textHit.json?.choices?.[0]?.message?.content?.trim() ?? "";
const usage = textHit.json?.usage;
ok(`Text OK in ${textMs}ms — model ${textHit.json?.model ?? textModel}`);
console.log(`  Response: ${content.slice(0, 120)}`);
if (usage) {
  console.log(
    `  Tokens: prompt=${usage.prompt_tokens ?? "?"} completion=${usage.completion_tokens ?? "?"} total=${usage.total_tokens ?? "?"}`,
  );
}

if (runVision) {
  console.log("\n--- Vision test (one card crop) ---");
  const imagePath = join(
    process.cwd(),
    "public",
    "catalog-variant-artwork",
    "base6",
    "base6-3_reverse.png",
  );
  if (!existsSync(imagePath)) {
    fail(`Vision image not found: ${imagePath}`);
  }
  const b64 = readFileSync(imagePath).toString("base64");
  const v0 = Date.now();
  const visionHit = await groqChat({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'Return JSON only: {"cards":[{"name":"Pikachu","set":"Base","number":"58","encapsulation":"raw"}]}',
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${b64}` },
          },
        ],
      },
    ],
    max_tokens: 400,
    temperature: 0,
  });
  const visionMs = Date.now() - v0;
  if (!visionHit.res.ok) {
    console.error("  HTTP", visionHit.res.status, visionHit.text.slice(0, 500));
    fail(
      "Groq vision failed — enable meta-llama/llama-4-scout-17b-16e-instruct in console allowlist.",
    );
  }
  const vContent = visionHit.json?.choices?.[0]?.message?.content?.trim() ?? "";
  const vUsage = visionHit.json?.usage;
  ok(`Vision OK in ${visionMs}ms`);
  console.log(`  Snippet: ${vContent.slice(0, 160).replace(/\s+/g, " ")}…`);
  if (vUsage) {
    console.log(
      `  Tokens: prompt=${vUsage.prompt_tokens ?? "?"} completion=${vUsage.completion_tokens ?? "?"} total=${vUsage.total_tokens ?? "?"}`,
    );
  }
} else {
  console.log("\n  Tip: run with --vision to test Llama 4 Scout on a sample card image.");
}

console.log("\n--- Worth it? (quick read) ---");
console.log("  Paid Groq is worth it if:");
console.log("  • Text + vision probes pass above");
console.log("  • Binder scans finish without OpenRouter/Gemini fallback errors");
console.log("  • Latency is acceptable (text <3s, vision <30s per page)");
console.log("  • Groq dashboard spend per 14-card scan fits your budget (~1 vision + optional report)");
console.log("\n  Next: restart dev server → sign in → GET /api/scan/liquid-chat");
console.log("  Then: one small photo scan with SCAN_AUTO_REPORT=0 to limit tokens.\n");

process.exit(0);
