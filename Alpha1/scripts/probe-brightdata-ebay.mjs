import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[line.slice(0, i).trim()] = v;
}

const url =
  "https://www.ebay.com/sch/i.html?_nkw=Pokemon+Charizard+PSA+9&LH_Sold=1&LH_Complete=1&_sacat=2536";
const zone = env.BRIGHTDATA_WEB_UNLOCKER_ZONE;
const key = env.BRIGHTDATA_API_KEY;

const variants = [
  ["render+expect", { render: true, expect: ".srp-results" }],
  ["render", { render: true }],
  ["plain", {}],
];

for (const [label, opts] of variants) {
  const body = { zone, url, format: "raw", country: "us" };
  if (opts.render) body.render = true;
  if (opts.expect) {
    body.headers = { "x-unblock-expect": JSON.stringify({ element: opts.expect }) };
  }
  const res = await fetch("https://api.brightdata.com/request?async=false", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const t = await res.text();
  console.log(label, res.status, "len", t.length);
  console.log("  hdr", Object.fromEntries([...res.headers.entries()].filter(([k]) => /luminati|brd|error/i.test(k))));
  console.log("  sample", t.slice(0, 200).replace(/\s+/g, " "));
}
