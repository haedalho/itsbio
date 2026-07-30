import {
  best, clean, humanizeSlug, normalizePath,
  normalizedUrlKey, stableProductId, unique,
} from "./kent-census-utils.mjs";

function buildExistingMaps(products) {
  const bySource = new Map();
  const bySlug = new Map();
  for (const product of products || []) {
    const source = normalizedUrlKey(product.sourceUrl);
    const slug = normalizePath(product.slug);
    if (source) bySource.set(source, [...(bySource.get(source) || []), product]);
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) || []), product]);
  }
  return { bySource, bySlug };
}

export function makePlan(candidates, products) {
  const existingMaps = buildExistingMaps(products);
  const plan = [];
  const matchedExistingIds = new Set();
  for (const candidate of candidates.values()) {
    const matches = unique(
      [...(existingMaps.bySource.get(normalizedUrlKey(candidate.sourceUrl)) || []),
        ...(existingMaps.bySlug.get(normalizePath(candidate.slug)) || [])],
      (row) => row._id,
    );
    matches.forEach((row) => matchedExistingIds.add(row._id));
    const existing = matches[0] || null;
    const title = best(candidate.titles, humanizeSlug(candidate.slug));
    const summary = best(candidate.summaries);
    const sku = best(candidate.skus);
    const images = unique(candidate.images, normalizedUrlKey);
    const listingPaths = unique(candidate.listingPaths, normalizePath);
    const patch = {};

    if (existing) {
      const oldListings = unique(existing.listingPaths || [], normalizePath);
      const oldImages = unique(existing.imageUrls || [], normalizedUrlKey);
      const mergedListings = unique([...oldListings, ...listingPaths], normalizePath);
      const mergedImages = unique([...oldImages, ...images], normalizedUrlKey);
      const weakTitle = !clean(existing.title) || clean(existing.title).toLowerCase() === humanizeSlug(candidate.slug).toLowerCase();
      if (!clean(existing.sourceUrl)) patch.sourceUrl = candidate.sourceUrl;
      if (weakTitle && title) patch.title = title;
      if (!clean(existing.summary) && summary) patch.summary = summary;
      if (!clean(existing.sku) && sku) patch.sku = sku;
      if (mergedListings.length !== oldListings.length) patch.listingPaths = mergedListings;
      if ((!Array.isArray(existing.categoryPath) || !existing.categoryPath.length) && mergedListings[0]) {
        patch.categoryPath = mergedListings[0].split("/").filter(Boolean);
      }
      if (mergedImages.length !== oldImages.length) patch.imageUrls = mergedImages;
      if (existing.isActive === false) patch.isActive = true;
    }

    plan.push({
      action: !existing ? "create" : Object.keys(patch).length ? "patch" : "unchanged",
      id: existing?._id || stableProductId(candidate.slug), existingId: existing?._id || null,
      duplicateIds: matches.slice(1).map((row) => row._id), slug: candidate.slug,
      sourceUrl: candidate.sourceUrl, title, summary, sku, images, listingPaths,
      discoveredFrom: candidate.discoveredFrom, trustedSources: candidate.trustedSources,
      pageValidated: candidate.pageValidated, patch,
    });
  }
  const sanityOnly = (products || []).filter((product) => !matchedExistingIds.has(product._id)).map((product) => ({
    id: product._id, title: product.title, slug: product.slug, sku: product.sku,
    sourceUrl: product.sourceUrl, isActive: product.isActive,
  })).sort((a, b) => clean(a.title).localeCompare(clean(b.title)));
  const rank = { create: 0, patch: 1, unchanged: 2 };
  return { plan: plan.sort((a, b) => rank[a.action] - rank[b.action] || a.slug.localeCompare(b.slug)), sanityOnly };
}

export async function applyPlan(sanity, plan, brandId) {
  let created = 0;
  let patched = 0;
  for (const row of plan) {
    if (row.action === "create") {
      await sanity.createIfNotExists({
        _id: row.id, _type: "product", isActive: true,
        brand: { _type: "reference", _ref: brandId }, title: row.title,
        slug: { _type: "slug", current: row.slug }, sourceUrl: row.sourceUrl, productType: "simple",
        ...(row.summary ? { summary: row.summary } : {}), ...(row.sku ? { sku: row.sku } : {}),
        ...(row.images.length ? { imageUrls: row.images } : {}),
        ...(row.listingPaths.length ? {
          listingPaths: row.listingPaths, categoryPath: row.listingPaths[0].split("/").filter(Boolean),
        } : {}),
      });
      created += 1;
    } else if (row.action === "patch" && row.existingId) {
      await sanity.patch(row.existingId).set(row.patch).commit();
      patched += 1;
    }
  }
  return { created, patched };
}

export function renderMarkdown(report) {
  const out = [
    "# Kent product census", "", `- 실행 시각: ${report.generatedAt}`,
    `- 발견한 고유 상품: ${report.counts.discovered}`,
    `- Shop에서 발견한 카드: ${report.counts.shopCardOccurrences}`,
    `- Shop 방문 페이지: ${report.counts.shopPages}`,
    `- Sitemap 상품 URL 발생 수: ${report.counts.sitemapProductLocOccurrences}`,
    `- 실제 상품 페이지 검증: ${report.counts.validatedProductPages}/${report.counts.checkedProductPages}`,
    `- 비상품·신뢰 부족으로 제외: ${report.counts.rejected}`,
    `- 새 skeleton 생성 대상: ${report.counts.create}`,
    `- 기존 문서 보강 대상: ${report.counts.patch}`,
    `- 변경 불필요: ${report.counts.unchanged}`,
    `- 중복 기존 문서 후보: ${report.counts.duplicateCandidates}`,
    `- Sanity에만 있는 상품: ${report.counts.sanityOnly}`,
    `- 실행 모드: ${report.write ? "WRITE" : "DRY RUN"}`, "",
  ];
  for (const action of ["create", "patch", "unchanged"]) {
    const rows = report.plan.filter((row) => row.action === action);
    out.push(`## ${action.toUpperCase()} (${rows.length})`, "");
    if (!rows.length) out.push("- 없음");
    for (const row of rows) {
      const details = [row.sku ? `SKU ${row.sku}` : "no SKU", `${row.listingPaths.length} listing`,
        `${row.images.length} image`, row.pageValidated ? "page validated" : "source trusted",
        row.duplicateIds.length ? `duplicates: ${row.duplicateIds.join(", ")}` : ""].filter(Boolean).join(" · ");
      out.push(`- **${row.title}** — \`${row.slug}\` · ${details}`);
    }
    out.push("");
  }
  out.push("## SANITY ONLY", "");
  if (!report.sanityOnly.length) out.push("- 없음");
  for (const row of report.sanityOnly) out.push(`- **${row.title || row.id}** — \`${row.slug || "no-slug"}\` · ${row.sourceUrl || "no source URL"}`);
  out.push("", "## REJECTED SOURCE CANDIDATES", "");
  if (!report.validation.rejected.length) out.push("- 없음");
  for (const row of report.validation.rejected) out.push(`- \`${row.slug}\` — ${row.reason} · ${row.sourceUrl}`);
  out.push("", "## 규칙", "",
    "- 공식 Shop의 WooCommerce 상품 카드를 1차 기준으로 사용한다.",
    "- Sanity category와 product sitemap은 Shop 누락을 보완하는 보조 수집원이다.",
    "- sitemap에만 존재하는 /products/ URL은 실제 WooCommerce product 페이지인지 검증 후 포함한다.",
    "- source URL과 slug를 기준으로 기존 상품을 먼저 찾는다.",
    "- 여러 카테고리에서 발견된 상품은 product 하나로 합치고 listingPaths만 병합한다.",
    "- 새 상품은 deterministic ID와 createIfNotExists를 사용한다.",
    "- 빈 수집값은 기존 값을 덮어쓰지 않는다.",
    "- Sanity-only 항목은 legacy 또는 discontinued일 수 있으므로 자동 삭제하지 않는다.",
    "- 옵션과 Kent 상세 섹션은 전체 skeleton 확보 후 별도 보강한다.", "");
  return out.join("\n");
}
