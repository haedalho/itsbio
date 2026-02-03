// scripts/abm-transform.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@sanity/client";
import * as cheerio from "cheerio";

// ---- env loader (.env.local) ----
function readEnvFile(filePath) {
  const buf = fs.readFileSync(filePath);
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString("utf8");
  return buf.toString("utf8");
}

function loadDotEnv(files = [".env.local", ".env"]) {
  for (const f of files) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = readEnvFile(p);
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

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET;
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const TOKEN = (process.env.SANITY_WRITE_TOKEN || "").trim();

if (!PROJECT_ID || !DATASET || !TOKEN) {
  console.error("[ERROR] Missing env: NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_WRITE_TOKEN");
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
const ONLY_IF_EMPTY = process.argv.includes("--only-if-empty");

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function absolutizeUrl(u, base) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return new URL(u, base).toString();
  return new URL(u, base).toString();
}

// 아주 단순한 PortableText block 생성기(텍스트 기반)
function ptParagraph(text) {
  return {
    _type: "block",
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", text: text || "", marks: [] }],
  };
}

function ptHeading(text, level = 2) {
  return {
    _type: "block",
    style: `h${Math.min(4, Math.max(2, level))}`,
    markDefs: [],
    children: [{ _type: "span", text: text || "", marks: [] }],
  };
}

function cleanText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// ABM 페이지에서 “본문” 후보를 고르는 휴리스틱
function pickMain($) {
  const selectors = [
    "#main-content",
    "#content",
    "main",
    ".main",
    ".content",
    "#container",
    ".container",
    "body",
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el && el.length) {
      // nav/footer/script 등 제거
      el.find("script,noscript,style,header,footer,nav").remove();
      return el;
    }
  }
  return $("body");
}

// nav/헤더/푸터 링크 같은 잡음을 줄이기 위한 간단 필터
function isLikelyNavLink(text, href) {
  const t = cleanText(text).toLowerCase();
  if (!t) return true;
  const bad = ["home", "login", "register", "contact", "about", "cart", "search", "wishlist"];
  if (bad.includes(t)) return true;
  if (!href) return true;
  return false;
}

// 이미지 다운로드 → Sanity 업로드
async function uploadImageFromUrl(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`image fetch ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (url.split(".").pop() || "jpg").split("?")[0].slice(0, 6);
  const filename = `abm-${sha1(url).slice(0, 10)}.${ext || "jpg"}`;
  const asset = await client.assets.upload("image", buf, { filename });
  return asset?._id;
}

// 파일(PDF 등) 다운로드 → Sanity 업로드
async function uploadFileFromUrl(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`file fetch ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (url.split(".").pop() || "pdf").split("?")[0].slice(0, 8);
  const filename = `abm-${sha1(url).slice(0, 10)}.${ext || "pdf"}`;
  const asset = await client.assets.upload("file", buf, { filename });
  return asset?._id;
}

function tableToSimpleTable($table, $) {
  const rows = [];
  $table.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = [];
    let isHeader = false;

    $tr.find("th,td").each((__, cell) => {
      const $c = $(cell);
      const txt = cleanText($c.text());
      if (txt) cells.push(txt);
      if ($c.is("th")) isHeader = true;
    });

    if (cells.length) rows.push({ _type: "row", cells, isHeader });
  });

  if (!rows.length) return null;

  return {
    _type: "simpleTable",
    caption: "",
    rows,
  };
}

async function transformOneCategory(doc) {
  const legacyHtml = doc.legacyHtml || "";
  const baseUrl = doc.sourceUrl || "https://www.abmgood.com/";

  const $ = cheerio.load(legacyHtml);
  const $main = pickMain($);

  // 1) 텍스트: h1/h2/h3/p/li 기반으로 PortableText 구성(단순 버전)
  const pt = [];
  $main.find("h1,h2,h3,h4,p,li").each((_, el) => {
    const $el = $(el);
    const tag = $el[0]?.tagName?.toLowerCase();
    const text = cleanText($el.text());
    if (!text) return;

    if (tag === "h1") pt.push(ptHeading(text, 2));
    else if (tag === "h2") pt.push(ptHeading(text, 2));
    else if (tag === "h3") pt.push(ptHeading(text, 3));
    else if (tag === "h4") pt.push(ptHeading(text, 4));
    else pt.push(ptParagraph(text));
  });

  // 2) 표: table → simpleTable blocks
  const tableBlocks = [];
  $main.find("table").each((_, t) => {
    const st = tableToSimpleTable($(t), $);
    if (!st) return;
    tableBlocks.push({
      _type: "tableSection",
      title: "",
      table: st,
      ctas: [],
    });
  });

  // 3) 이미지: img → 업로드 후 imageSection blocks
  const imageBlocks = [];
  const imgUrls = [];
  $main.find("img").each((_, img) => {
    const src = $(img).attr("src");
    const abs = absolutizeUrl(src, baseUrl);
    if (abs) imgUrls.push(abs);
  });

  // 중복 제거
  const uniqImgs = Array.from(new Set(imgUrls)).slice(0, 12); // 한 페이지 너무 많으면 제한
  for (const u of uniqImgs) {
    try {
      if (DRY) {
        imageBlocks.push({
          _type: "imageSection",
          title: "",
          image: {
            _type: "image",
            asset: { _type: "reference", _ref: "dry-run" },
            alt: "",
            caption: u,
          },
          ctas: [],
        });
      } else {
        const assetId = await uploadImageFromUrl(u);
        imageBlocks.push({
          _type: "imageSection",
          title: "",
          image: {
            _type: "image",
            asset: { _type: "reference", _ref: assetId },
            alt: "",
            caption: "",
          },
          ctas: [],
        });
      }
    } catch (e) {
      // 실패해도 진행
      imageBlocks.push({
        _type: "imageSection",
        title: "",
        image: {
          _type: "image",
          // 업로드 실패한 URL은 caption에 남겨서 나중에 재시도 가능
          asset: DRY ? { _type: "reference", _ref: "dry-run" } : undefined,
          alt: "",
          caption: u,
        },
        ctas: [],
      });
    }

    await sleep(150);
  }

  // 4) 다운로드: pdf 링크 → file 업로드 후 downloads block
  const fileLinks = [];
  $main.find("a").each((_, a) => {
    const href = $(a).attr("href");
    const txt = cleanText($(a).text());
    const abs = absolutizeUrl(href, baseUrl);
    if (!abs) return;
    if (abs.toLowerCase().endsWith(".pdf")) {
      fileLinks.push({ href: abs, label: txt || "PDF" });
    }
  });

  const uniqFiles = [];
  const seenFile = new Set();
  for (const f of fileLinks) {
    if (seenFile.has(f.href)) continue;
    seenFile.add(f.href);
    uniqFiles.push(f);
  }

  let downloadsBlock = null;
  if (uniqFiles.length) {
    const files = [];
    for (const f of uniqFiles.slice(0, 10)) {
      try {
        if (DRY) {
          files.push({
            _type: "file",
            asset: { _type: "reference", _ref: "dry-run" },
            label: f.label,
          });
        } else {
          const assetId = await uploadFileFromUrl(f.href);
          files.push({
            _type: "file",
            asset: { _type: "reference", _ref: assetId },
            label: f.label,
          });
        }
      } catch {
        // 실패 링크는 label에 남김
      }
      await sleep(150);
    }

    if (files.length) {
      downloadsBlock = {
        _type: "downloads",
        title: "Downloads",
        files,
      };
    }
  }

  // 5) CTA: 본문 링크 중 “의미 있어 보이는 것”만 뽑기(선택)
  const ctas = [];
  $main.find("a").each((_, a) => {
    const href = $(a).attr("href");
    const text = cleanText($(a).text());
    const abs = absolutizeUrl(href, baseUrl);
    if (!abs) return;
    if (isLikelyNavLink(text, abs)) return;
    if (abs.toLowerCase().endsWith(".pdf")) return; // 다운로드는 downloads로
    if (text.length < 3 || text.length > 40) return;

    ctas.push({
      _type: "cta",
      label: text,
      href: abs,
      variant: "secondary",
      openInNewTab: true,
    });
  });

  // 중복 제거 + 상위 6개
  const ctaUniq = [];
  const seenCta = new Set();
  for (const c of ctas) {
    const k = `${c.label}@@${c.href}`;
    if (seenCta.has(k)) continue;
    seenCta.add(k);
    ctaUniq.push(c);
  }

  // 최종 contentBlocks: richText + tables + images + downloads
  const content = [];
  if (pt.length) {
    content.push({
      _type: "richText",
      title: "",
      body: pt.concat([]), // body: PortableText
      ctas: [],
    });
  }
  content.push(...tableBlocks);
  content.push(...imageBlocks);
  if (downloadsBlock) content.push(downloadsBlock);

  return { content, ctas: ctaUniq.slice(0, 6) };
}

async function main() {
  console.log("[run]", { DRY, LIMIT, ONLY_IF_EMPTY });

const query = `
*[
  _type=="category"
  && (
    themeKey == $k
    || brand->themeKey == $k
    || brand->slug.current == $k
  )
]
| order(_createdAt desc) {
  _id, title, sourceUrl, legacyHtml, content, themeKey, "brandKey": brand->themeKey
}
`;


  const docs = await client.fetch(query, { k: "abm" });
  console.log("[fetch]", { total: docs.length });

  let done = 0;

  for (const doc of docs) {
    if (LIMIT && done >= LIMIT) break;

    if (ONLY_IF_EMPTY && doc.content && Array.isArray(doc.content) && doc.content.length > 0) {
      continue;
    }

    console.log(`\n[doc] ${doc._id} :: ${doc.title}`);

    const { content, ctas } = await transformOneCategory(doc);

    if (DRY) {
      console.log("[DRY] blocks:", content.length, "ctas:", ctas.length);
    } else {
      await client
        .patch(doc._id)
        .set({
          content,
          ctas,
          migratedAt: new Date().toISOString(),
        })
        .commit({ autoGenerateArrayKeys: true });

      console.log("[OK] patched:", doc._id, "blocks:", content.length, "ctas:", ctas.length);
    }

    done++;
    await sleep(250);
  }

  console.log("\n✅ ABM transform done.");
}

main().catch((e) => {
  console.error("\n[ERROR]", e?.responseBody || e);
  process.exit(1);
});
