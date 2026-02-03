import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

// .env.local loader (간단)
function loadDotEnv(files = [".env.local", ".env"]) {
  for (const f of files) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 0) continue;
      const key = s.slice(0, eq).trim();
      let val = s.slice(eq + 1).trim();
      val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadDotEnv();

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token: (process.env.SANITY_WRITE_TOKEN || "").trim(),
  useCdn: false,
});

console.log("[env]", {
  projectId: client.config().projectId,
  dataset: client.config().dataset,
  apiVersion: client.config().apiVersion,
  hasToken: !!client.config().token,
  tokenLen: (client.config().token || "").length,
});

try {
  const q = '*[_type=="notice"][0]{_id,title}';
  const r = await client.fetch(q);
  console.log("OK", r);
} catch (e) {
  console.error("ERR", e?.responseBody || e);
}
