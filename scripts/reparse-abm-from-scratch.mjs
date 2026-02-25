import "dotenv/config";
import { createClient } from "next-sanity";
import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";

const {
  NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_WRITE_TOKEN,
} = process.env;

if (!NEXT_PUBLIC_SANITY_PROJECT_ID || !NEXT_PUBLIC_SANITY_DATASET || !NEXT_PUBLIC_SANITY_API_VERSION) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_* env vars");
}
if (!SANITY_WRITE_TOKEN) {
  throw new Error("Missing SANITY_WRITE_TOKEN");
}

const sanity = createClient({
  projectId: NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: NEXT_PUBLIC_SANITY_API_VERSION,
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
});

const BRAND_KEY = "abm";
const ABM_BASE = "https://www.abmgood.com";

function textClean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizePanel(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      "*": ["class", "id"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}

function isJunkImage(url) {
  const u = (url || "").toLowerCase();
  if (!u) return true;
  return (
    u.includes("logo") ||
    u.includes("flag") ||
    u.includes("favicon") ||
    u.includes("sprite") ||
    u.includes("icon") ||
    u.includes("banner") ||
    u.includes("header") ||
    u.includes("footer") ||
    u.includes("payment") ||
    u.includes("social")
  );
}

function cssEscape(id) {
  return id.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function parseBreadcrumb($) {
  const titles = [];
  const $bc = $(".breadcrumbs").first().length ? $(".breadcrumbs").first() : $(".breadcrumb").first();
  if ($bc.length) {
    $bc.find("a, span").each((_, el) => {
      const t = textClean($(el).text());
      if (!t) return;
      if (/^home$/i.test(t)) return;
      titles.push(t);
    });
  }
  // 제품명 섞이는 케이스 방지: 뒤에서 2~3단계만 사용
  const uniq = [];
  for (const t of titles) if (!uniq.includes(t)) uniq.push(t);
  const sliced = uniq.length > 4 ? uniq.slice(-3) : uniq;
  return { titles: sliced, slugs: sliced.map(slugify).filter(Boolean) };
}

function parseSku($) {
  // 다양한 케이스 대응: "Cat. No" "Cat No" "Catalog No" 등
  const text = $("body").text();
  const m = text.match(/\b(?:Cat\.?\s*No\.?|Catalog\s*No\.?|SKU)\s*[:#]?\s*([A-Za-z0-9-]{3,20})\b/i);
  return m ? m[1] : "";
}

function parseTabs5($) {
  const wanted = ["Datasheet", "Documents", "FAQs", "References", "Reviews"];
  const out = { datasheetHtml: "", documentsHtml: "", faqsHtml: "", referencesHtml: "", reviewsHtml: "" };

  const map = new Map();

  const $tabLinks = $("a[href^='#'], [aria-controls]").filter((_, el) => {
    const t = textClean($(el).text()).toLowerCase();
    return wanted.some((w) => w.toLowerCase() === t);
  });

  $tabLinks.each((_, el) => {
    const label = textClean($(el).text()).toLowerCase();
    const href = $(el).attr("href");
    const ac = $(el).attr("aria-controls");
    const id = (href && href.startsWith("#") ? href.slice(1) : ac) || "";
    if (id) map.set(label, id);
  });

  for (const w of wanted) {
    const key = w.toLowerCase();
    const id = map.get(key);
    let raw = "";
    if (id) {
      const $panel = $(`#${cssEscape(id)}`);
      if ($panel.length) raw = $panel.html() || "";
    }

    if (!raw) {
      const $h = $("h1,h2,h3,h4").filter((_, el) => textClean($(el).text()).toLowerCase() === key).first();
      if ($h.length) {
        const parts = [];
        let $cur = $h.next();
        let guard = 0;
        while ($cur.length && guard < 40) {
          const tag = ($cur.get(0)?.tagName || "").toLowerCase();
          if (["h1", "h2", "h3", "h4"].includes(tag)) break;
          parts.push($.html($cur));
          $cur = $cur.next();
          guard++;
        }
        raw = parts.join("\n");
      }
    }

    const cleaned = sanitizePanel(raw);
    if (w === "Datasheet") out.datasheetHtml = cleaned;
    if (w === "Documents") out.documentsHtml = cleaned;
    if (w === "FAQs") out.faqsHtml = cleaned;
    if (w === "References") out.referencesHtml = cleaned;
    if (w === "Reviews") out.reviewsHtml = cleaned;
  }

  return out;
}

function parseDocs($) {
  const docs = [];
  $("a[href$='.pdf'], a[href*='.pdf?']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = href.startsWith("http") ? href : new URL(href, ABM_BASE).toString();
    const title = textClean($(el).text()) || "PDF";
    docs.push({ title, url });
  });
  const seen = new Set();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

function parseImages($) {
  const imgs = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src) return;
    const url = src.startsWith("http") ? src : new URL(src, ABM_BASE).toString();
    if (isJunkImage(url)) return;
    imgs.push(url);
  });
  return [...new Set(imgs)];
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    },
  });

  clearTimeout(t);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function ensureBrandRef() {
  const b = await sanity.fetch(
    `*[_type=="brand" && (slug.current==$brandKey || themeKey==$brandKey)][0]{_id}`,
    { brandKey: BRAND_KEY }
  );
  if (!b?._id) throw new Error("ABM brand document not found in Sanity");
  return { _type: "reference", _ref: b._id };
}

async function main() {
  const brandRef = await ensureBrandRef();

  const LIMIT = Number(process.env.LIMIT || "0"); // 0=all
  const DRY = String(process.env.DRY || "").toLowerCase() === "1";

  const items = await sanity.fetch(
    `*[_type=="product" && (brand->slug.current==$brandKey || brand->themeKey==$brandKey) && defined(sourceUrl)]|order(_updatedAt asc){_id,title,sku,sourceUrl,"slug":slug.current}`,
    { brandKey: BRAND_KEY }
  );

  const targets = LIMIT > 0 ? items.slice(0, LIMIT) : items;
  console.log(`Targets: ${targets.length} (dry=${DRY})`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const it = targets[i];
    const url = String(it.sourceUrl || "").trim();
    if (!url) continue;

    try {
      console.log(`\n[${i + 1}/${targets.length}] ${it.slug || it._id} :: ${url}`);

      const html = await fetchHtml(url);
      const $ = load(html);

      const bc = parseBreadcrumb($);
      const sku = parseSku($) || it.sku || "";
      const title = textClean($("h1").first().text()) || it.title || sku || it.slug;

      const tabs = parseTabs5($);
      const docs = parseDocs($);
      const imageUrls = parseImages($);

      const patch = {
        isActive: true,
        brand: brandRef,
        title,
        sku,
        sourceUrl: url,
        categoryPath: bc.slugs,
        categoryPathTitles: bc.titles,
        datasheetHtml: tabs.datasheetHtml || "",
        documentsHtml: tabs.documentsHtml || "",
        faqsHtml: tabs.faqsHtml || "",
        referencesHtml: tabs.referencesHtml || "",
        reviewsHtml: tabs.reviewsHtml || "",
        docs,
        imageUrls,
        enrichedAt: new Date().toISOString(),
      };

      if (DRY) {
        console.log("DRY patch keys:", Object.keys(patch).join(", "));
      } else {
        await sanity.patch(it._id).set(patch).commit();
      }

      ok++;
    } catch (e) {
      fail++;
      console.error("FAILED:", e?.message || e);
    }
  }

  console.log(`\nDone. ok=${ok}, fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
