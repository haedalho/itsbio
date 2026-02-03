// scripts/extract-abm.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@sanity/client";

// ✅ .env.local / .env 자동 로드 (Next 밖에서 실행할 때 필요)
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

/**
 * ENV (이미 너희 프로젝트에 있을 가능성 높음)
 * - NEXT_PUBLIC_SANITY_PROJECT_ID
 * - NEXT_PUBLIC_SANITY_DATASET
 * - NEXT_PUBLIC_SANITY_API_VERSION
 * - SANITY_WRITE_TOKEN   <-- write 권한 토큰 (필수)
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const TOKEN = (process.env.SANITY_WRITE_TOKEN || "").trim();

if (!TOKEN) {
  console.error(
    "\n[ERROR] SANITY_WRITE_TOKEN 이 필요해.\n" +
      "Windows PowerShell 예:\n" +
      '$env:SANITY_WRITE_TOKEN="YOUR_TOKEN"\n'
  );
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

const DRY = process.argv.includes("--dry");
const LIMIT = (() => {
  const i = process.argv.findIndex((x) => x === "--limit");
  if (i >= 0) return Number(process.argv[i + 1] || "0") || 0;
  return 0;
})();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

// ✅ ProductsMegaMenu.tsx 안의 MENU 배열을 "그대로" 평가해서 JS 객체로 뽑아냄
function loadMenuFromRepo() {
  const file = path.resolve(process.cwd(), "components/site/ProductsMegaMenu.tsx");
  const src = fs.readFileSync(file, "utf8");

  const anchor = src.indexOf("const MENU");
  if (anchor < 0) throw new Error("MENU constant not found in ProductsMegaMenu.tsx");

  
  // ✅ '=' 이후에 나오는 실제 배열 시작 '['를 찾는다 (MenuItem[] 타입의 []는 무시)
  const eq = src.indexOf("=", anchor);
  if (eq < 0) throw new Error("MENU '=' not found");

  const firstBracket = src.indexOf("[", eq);
  if (firstBracket < 0) throw new Error("MENU array start '[' not found");

  // bracket matching (문자열 내부까지 완벽 파싱은 아니지만 이 파일 구조엔 충분)
  let depth = 0;
  let end = -1;
  for (let i = firstBracket; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("MENU array end ']' not found");

  const arrayLiteral = src.slice(firstBracket, end + 1);

  // eslint-disable-next-line no-new-func
  const MENU = new Function(`return (${arrayLiteral});`)();
  if (!Array.isArray(MENU)) throw new Error("MENU evaluation failed");
  return MENU;
}


async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "accept-language": "en-US,en;q=0.9,ko;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return await res.text();
}

// ✅ 1차는 “그럴듯한 본문 HTML”만 뽑아서 legacyHtml로 저장 (정교 파싱은 2차)
function extractMainHtml(html) {
  // 간단 휴리스틱: 본문 후보 구간을 크게 잘라서 저장
  const candidates = [
    'id="main-content"',
    'id="content"',
    'class="content"',
    'class="main"',
    'id="container"',
    'class="container"',
  ];

  let idx = -1;
  for (const key of candidates) {
    idx = html.indexOf(key);
    if (idx >= 0) break;
  }
  if (idx < 0) {
    // fallback: body만
    const b0 = html.indexOf("<body");
    const b1 = html.indexOf("</body>");
    if (b0 >= 0 && b1 > b0) return html.slice(b0, b1 + 7);
    return html.slice(0, Math.min(html.length, 200000));
  }

  // 주변으로 크게 자르기 (앞뒤 8만자)
  const start = Math.max(0, idx - 20000);
  const end = Math.min(html.length, idx + 120000);
  return html.slice(start, end);
}

function extractTitle(html) {
  const og = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (og) return og.trim();

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return h1.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (t) return t.replace(/\s+/g, " ").trim();

  return "";
}

function extractSummary(html) {
  const d = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (d) return d.trim();

  // fallback: 첫 p 텍스트
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  if (p) return p.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);

  return "";
}

async function ensureBrandABM() {
  const brandKey = "abm";
  const exists = await client.fetch(
    `*[_type=="brand" && (themeKey==$k || slug.current==$k)][0]{_id}`,
    { k: brandKey }
  );

  const doc = {
    _type: "brand",
    title: "ABM",
    themeKey: "abm",
    websiteUrl: "https://www.abmgood.com",
    slug: { _type: "slug", current: "abm" },
    summary: "Imported from abmgood.com (initial extraction).",
  };

  const brandId = exists?._id || `brand-${brandKey}`;
  if (DRY) {
    console.log("[DRY] upsert brand:", brandId);
    return brandId;
  }

  await client.createIfNotExists({ _id: brandId, ...doc });
  await client.patch(brandId).set(doc).commit({ autoGenerateArrayKeys: true });
  return brandId;
}

function walkTree(node, fn, parent = null, depth = 0) {
  fn(node, parent, depth);
  if (node?.children?.length) {
    for (const ch of node.children) walkTree(ch, fn, node, depth + 1);
  }
}

async function upsertCategory({ brandId, brandKey, title, url, pathSegs, parentId, legacyHtml, summary }) {
  const idBase = `${brandKey}:${pathSegs.join("/")}`;
  const docId = `category-${brandKey}-${sha1(idBase)}`;

  const doc = {
    _id: docId,
    _type: "category",
    title,
    brand: { _type: "reference", _ref: brandId },
    parent: parentId ? { _type: "reference", _ref: parentId } : undefined,
    path: pathSegs,
    themeKey: brandKey,
    sourceUrl: url,
    summary: summary || "",
    legacyHtml: legacyHtml || "",
    order: 0,
  };

  // sanity patch는 undefined field를 그대로 두면 깔끔
  if (!doc.parent) delete doc.parent;

  if (DRY) {
    console.log("[DRY] upsert category:", docId, pathSegs.join("/"), url || "");
    return docId;
  }

  await client.createIfNotExists(doc);
  await client
    .patch(docId)
    .set({
      title: doc.title,
      brand: doc.brand,
      parent: doc.parent,
      path: doc.path,
      themeKey: doc.themeKey,
      sourceUrl: doc.sourceUrl,
      summary: doc.summary,
      legacyHtml: doc.legacyHtml,
    })
    .commit({ autoGenerateArrayKeys: true });

  return docId;
}

async function main() {
  const MENU = loadMenuFromRepo();
  const abm = MENU.find((x) => String(x?.label).toLowerCase() === "abm");
  if (!abm) throw new Error("ABM menu item not found (label: 'abm')");

  console.log("ABM root children:", (abm.children || []).map((x) => x.label));
  console.log("ABM children count:", (abm.children || []).length);
  
  const brandId = await ensureBrandABM();
  const brandKey = "abm";

  // ✅ abm.href(itsbio.co.kr page_id=196)는 “브랜드 루트” 정도로만 쓰고,
  // ✅ 실제 카테고리/컨텐츠는 children의 abmgood.com URL에서 추출
  const nodes = abm.children || [];

  const idMap = new Map(); // pathKey -> docId

  let count = 0;

  for (const root of nodes) {
    walkTree(root, () => {});
    // depth-first 직접 처리(부모 먼저 생성 필요)
    const stack = [{ node: root, parent: null }];
    while (stack.length) {
      const { node, parent } = stack.shift();

      const label = String(node.label || "").trim();
      const url = String(node.href || "").trim();

      // path segments: 부모 path + 현재 slug
      const parentKey = parent ? idMap.get(parent.__pathKey) : null;
      const mySlug = slugify(label) || `node-${sha1(label + url)}`;
      const myPath = parent ? [...parent.__path, mySlug] : [mySlug];
      const pathKey = myPath.join("/");

      // 메모용(트리 내에서만)
      node.__path = myPath;
      node.__pathKey = pathKey;

      // 원본 페이지 fetch (abmgood.com 위주)
      let legacyHtml = "";
      let pageTitle = label;
      let summary = "";

      // 너무 과한 트래픽 방지용: url이 http(s)인 경우만 fetch
      if (/^https?:\/\//i.test(url)) {
        try {
          const html = await fetchHtml(url);
          pageTitle = extractTitle(html) || label;
          summary = extractSummary(html) || "";
          legacyHtml = extractMainHtml(html);
        } catch (e) {
          console.warn("[WARN] fetch failed:", url, e?.message || e);
        }
      }

      const docId = await upsertCategory({
        brandId,
        brandKey,
        title: pageTitle,
        url,
        pathSegs: myPath,
        parentId: parentKey,
        legacyHtml,
        summary,
      });

      idMap.set(pathKey, docId);

      count++;
      if (LIMIT && count >= LIMIT) {
        console.log(`\n[STOP] --limit ${LIMIT} reached`);
        return;
      }

      // children enqueue (부모 생성 후)
      if (node.children?.length) {
        for (const ch of node.children) {
          stack.push({ node: ch, parent: node });
        }
      }

      // 요청 간 간격
      await sleep(250);
    }
  }

  console.log("\n✅ ABM extraction done.");
}

main().catch((e) => {
  console.error("\n[ERROR]", e);
  process.exit(1);
});
