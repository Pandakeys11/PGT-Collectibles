import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();
const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!ref || !password) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

if (process.env.SUPABASE_DB_URL?.trim()) {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL.trim(),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    console.log("OK SUPABASE_DB_URL");
    await client.end();
    process.exit(0);
  } catch (err) {
    console.log("FAIL SUPABASE_DB_URL", err.message.slice(0, 120));
  }
}

const enc = encodeURIComponent(password);
const regions = ["us-east-1", "us-east-2", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];
const urls = [`postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`];
for (const region of regions) {
  urls.push(
    `postgresql://postgres.${ref}:${enc}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
  );
}

for (const connectionString of urls) {
  const host = connectionString.split("@")[1]?.split("/")[0] ?? "?";
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("OK", host);
    console.log("\nAdd to .env.local:\nSUPABASE_DB_URL=" + connectionString.replace(password, "***"));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.log("FAIL", host, "-", err.message.slice(0, 100));
  }
}
process.exit(1);
