/**
 * Quick xAI API key + vision capability check (no full benchmark).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const key =
  process.env.XAI_API_KEY?.trim() ||
  process.env.XAi_API_KEY?.trim() ||
  process.env.GROK_API_KEY?.trim();

if (!key) {
  console.error("Missing XAI_API_KEY (or XAi_API_KEY) in .env.local");
  process.exit(1);
}

console.log("xAI key: present (length", key.length + ")");

const modelsRes = await fetch("https://api.x.ai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
if (modelsRes.ok) {
  const models = await modelsRes.json();
  const ids = (models.data ?? models.models ?? [])
    .map((m) => m.id ?? m.name)
    .filter(Boolean)
    .filter((id) => /vision|grok-4|grok-2/i.test(id))
    .slice(0, 12);
  console.log("Vision-related models:", ids.join(", ") || "(none matched filter)");
} else {
  console.log("Models list:", modelsRes.status, (await modelsRes.text()).slice(0, 200));
}

const img = readFileSync(
  join(process.cwd(), "public/catalog-variant-artwork/base6/base6-3_reverse.png"),
).toString("base64");

const candidates = [
  process.env.XAI_VISION_MODEL?.trim(),
  "grok-4-1-fast-non-reasoning",
  "grok-4-fast-non-reasoning",
  "grok-4-1-fast-reasoning",
  "grok-2-vision-1212",
  "grok-2-vision-latest",
].filter(Boolean);

let lastErr = "";
for (const model of [...new Set(candidates)]) {
const t0 = Date.now();
const res = await fetch("https://api.x.ai/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: `data:image/png;base64,${img}`,
            detail: "high",
          },
          {
            type: "input_text",
            text: 'Identify this Pokemon TCG card. Reply JSON: {"name":"","set":"","number":""}',
          },
        ],
      },
    ],
  }),
});

const ms = Date.now() - t0;
const body = await res.text();
console.log(`\nVision probe (${model}): HTTP ${res.status} in ${ms}ms`);
if (!res.ok) {
  lastErr = body.slice(0, 300);
  console.log(lastErr);
  continue;
}

const data = JSON.parse(body);
const text =
  data.output_text ??
  data.output?.map?.((o) => JSON.stringify(o)).join(" ") ??
  JSON.stringify(data).slice(0, 500);
console.log("Response preview:", String(text).slice(0, 300));
console.log("\nOK — xAI vision works with model:", model);
process.exit(0);
}

console.error("\nAll xAI models failed. Last error:", lastErr);
console.error(
  "\nIf you see 403 credits/licenses: add billing at https://console.x.ai/",
);
process.exit(1);
