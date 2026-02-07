// scripts/apply-category-contentBlocks-from-json.mjs
// 사용 예:
// node --env-file=.env.local scripts/apply-category-contentBlocks-from-json.mjs \
//   --id category-abm-01d0ef5e7e \
//   --json .\tmp\special-cell-line-collection.extracted.json \
//   --dryRun
//
// 실제 반영:
// node --env-file=.env.local scripts/apply-category-contentBlocks-from-json.mjs \
//   --id category-abm-01d0ef5e7e \
//   --json .\tmp\special-cell-line-collection.extracted.json

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "next-sanity";

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isAbsUrl(u) {
  return /^https?:\/\//i.test(u || "");
}

function toAbsUrl(baseUrl, u) {
  if (!u) return "";
  if (isAbsUrl(u)) return u;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return baseUrl.replace(/\/$/, "") + u;
  return u;
}

function patchHtmlUrls(html, baseUrl) {
  if (!html) return html;

  // href="/..." / src="/..." 를 baseUrl 붙인 절대경로로 변환
  // (이미 extractor에서 했더라도 한번 더 안전하게)
  return String(html)
    .replace(/href=(["'])\/(?!\/)([^"']+)\1/gi, (_m, q, rest) => {
      const abs = toAbsUrl(baseUrl, "/" + rest);
      return `href=${q}${abs}${q}`;
    })
    .replace(/src=(["'])\/(?!\/)([^"']+)\1/gi, (_m, q, rest) => {
      const abs = toAbsUrl(baseUrl, "/" + rest);
      return `src=${q}${abs}${q}`;
    });
}

function normalizeBlocks(input, baseUrl) {
  const blocks = Array.isArray(input?.contentBlocks) ? input.contentBlocks : [];
  const out = [];

  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const t = b._type;

    if (t === "contentBlockHtml") {
      const html = patchHtmlUrls(b.html || "", baseUrl);
      if (!html.trim()) continue;
      out.push({
        _type: "contentBlockHtml",
        _key: b._key || Math.random().toString(36).slice(2),
        title: b.title || "Content",
        html,
      });
      continue;
    }

    if (t === "contentBlockResources") {
      const items = Array.isArray(b.items) ? b.items : [];
      const cleaned = items
        .filter(Boolean)
        .map((x) => ({
          _type: "contentResourceItem",
          _key: x._key || Math.random().toString(36).slice(2),
          title: String(x.title || "").trim(),
          subtitle: String(x.subtitle || "").trim(),
          href: String(x.href || "").trim(),
          imageUrl: String(x.imageUrl || "").trim(),
        }))
        .filter((x) => x.title && x.href); // Link 에러 방지(필수)

      if (!cleaned.length) continue;

      out.push({
        _type: "contentBlockResources",
        _key: b._key || Math.random().toString(36).slice(2),
        title: b.title || "Resources",
        items: cleaned,
      });
      continue;
    }

    if (t === "contentBlockPublications") {
      const items = Array.isArray(b.items) ? b.items : [];
      const cleaned = items
        .filter(Boolean)
        .map((x) => ({
          _type: "contentPublicationItem",
          _key: x._key || Math.random().toString(36).slice(2),
          order: typeof x.order === "number" ? x.order : Number(x.order) || undefined,
          citation: String(x.citation || "").trim(),
          doi: String(x.doi || "").trim(),
          product: String(x.product || "").trim(),
        }))
        .filter((x) => x.citation);

      if (!cleaned.length) continue;

      out.push({
        _type: "contentBlockPublications",
        _key: b._key || Math.random().toString(36).slice(2),
        title: b.title || "Top Publications",
        items: cleaned,
      });
      continue;
    }

    // 나머지 블록 타입은 지금은 스킵(추가되면 여기 확장)
  }

  return out;
}

async function main() {
  const id = argValue("--id");
  const jsonPath = argValue("--json");
  const baseUrl = argValue("--baseUrl") || "https://www.abmgood.com";
  const dryRun = process.argv.includes("--dryRun");

  if (!id) throw new Error("Missing --id <categoryId>");
  if (!jsonPath) throw new Error("Missing --json <file>");

  const absJson = path.resolve(process.cwd(), jsonPath);
  const raw = fs.readFileSync(absJson, "utf8");
  const parsed = JSON.parse(raw);

  const contentBlocks = normalizeBlocks(parsed, baseUrl);

  const client = createClient({
    projectId: mustEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
    dataset: mustEnv("NEXT_PUBLIC_SANITY_DATASET"),
    apiVersion: "2025-01-01",
    token: mustEnv("SANITY_WRITE_TOKEN"),
    useCdn: false,
  });

  const payload = {
    contentBlocks,
  };

  const summary = {
    id,
    json: absJson,
    blocksCount: contentBlocks.length,
    blockTypes: contentBlocks.map((b) => b._type),
    firstBlockType: contentBlocks[0]?._type ?? null,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("DRY RUN: not patching.");
    return;
  }

  const res = await client.patch(id).set(payload).commit({ autoGenerateArrayKeys: false });
  console.log("Patched:", res._id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
