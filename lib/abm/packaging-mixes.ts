const PACKAGING_PATH = "genetic-materials/kits-for-viral-vectors/virus-packaging-dna-mixes";

// ABM category reviewed 2026-10-07. The workflow is the same official asset
// already rehosted for LV053 (original filename XLsbWjcEswBRFtRlopIQY0SnJXoULjIG3RJGpwGz.jpg).
const WORKFLOW = "https://cdn.sanity.io/images/9b5twpc8/production/35da2c880ee0ab3fe32ab098fd65f40934f3dc96-6619x3583.jpg?w=1600";

const PACKAGING_INTRO = `
<div data-itsbio-packaging-intro="true">
<ul>
  <li>Packaging mixes support lentivirus, retrovirus and AAV production.</li>
  <li>Lentiviral generations differ in how helper functions are separated; AAV mixes are selected by serotype.</li>
  <li>Compatible transfection, titration and transduction reagents complete the workflow.</li>
</ul>
<details class="itsbio-packaging-explainer">
<summary>Understanding viral packaging mixes</summary>
<div>
<p>Helper plasmids supply particle-production functions, while a separate transfer vector carries the intended genetic cargo. Producer cells such as HEK293T supply the environment for assembly.</p>
<p>Lentiviral helpers encode structural, enzymatic, regulatory and envelope functions. Third-generation systems place Rev on a separate helper plasmid; second-generation systems combine more functions.</p>
<p>AAV uses Rep, Cap and adenoviral helper functions. Its cargo usually remains outside the host genome, whereas lentiviral and retroviral vectors are commonly used for integration.</p>
<p>Separating these functions reduces recombination risk. DNA quality, transfection performance and producer-cell condition also influence results.</p>
<div class="abm-table-scroll" role="region" aria-label="Viral system comparison" tabindex="0">
<table data-itsbio-packaging-comparison="true">
<thead><tr><th>Feature</th><th>Lentivirus</th><th>Retrovirus</th><th>AAV</th></tr></thead>
<tbody>
<tr><td>Integration</td><td>Yes</td><td>Yes</td><td>Generally no</td></tr>
<tr><td>Non-dividing cells</td><td>Yes</td><td>Limited</td><td>Yes</td></tr>
<tr><td>Cargo capacity</td><td>~8 kb</td><td>~8 kb</td><td>~4.7 kb</td></tr>
<tr><td>Persistent expression</td><td>Excellent</td><td>Good</td><td>Excellent</td></tr>
<tr><td>Typical use</td><td>Stable expression, CRISPR</td><td>Stable expression in dividing cells</td><td>In vivo delivery</td></tr>
</tbody></table></div>
</div></details>
<h2>Why choose ABM packaging mixes?</h2>
<ul><li>Used in more than 70 publications</li><li>Quality-controlled formulations</li><li>Options across three viral systems</li><li>Broad transfer-vector compatibility</li><li>Designed for efficient production</li></ul>
<figure class="itsbio-packaging-workflow"><img src="${WORKFLOW}" alt="3rd Generation Lentivirus Packaging Workflow" width="800" height="433" loading="lazy"></figure>
</div>`;

type CategoryBlock = { _type?: string; _key?: string; html?: string; items?: unknown[]; [key: string]: unknown };

// These four official learning banners are already used in the staged ABM
// catalog. Match by destination so an unrelated resource is never relabeled.
const RESOURCE_IMAGES: Record<string, string> = {
  "https://info.abmgood.com/crispr-cas9-introduction": "5f0c10c80b571ccb9c4e2bc35b37c95f28ec71d5",
  "https://info.abmgood.com/lentivirus-system": "0caec06d93d610450943579e96cad0055bfe8cbe",
  "https://info.abmgood.com/adeno-associated-virus-aav": "84498ce2e5950b8c88f027760e3468b18580b038",
  "https://info.abmgood.com/adenovirus-system": "cccb94fc52073e518a9178d1bbb0881e3ec59d33",
};

function restoreResourceImages(block: CategoryBlock): CategoryBlock {
  if (!block.items) return block;
  const items = block.items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const resource = item as Record<string, unknown>;
    const asset = RESOURCE_IMAGES[String(resource.href || "").replace(/\/$/, "")];
    if (!asset) return item;
    return { ...resource, imageUrl: resource.imageUrl || `https://cdn.sanity.io/images/9b5twpc8/production/${asset}-705x405.png`, imageFit: "contain" };
  });
  return items.every((item, index) => item === block.items?.[index]) ? block : { ...block, title: "Resources", items };
}

/** Restore the missing category sections without writing shared production CMS
 * data. The migrated product table and resource records remain authoritative. */
export function restorePackagingMixesBlocks(path: string, blocks: CategoryBlock[]): CategoryBlock[] {
  if (path !== PACKAGING_PATH) return blocks;
  const htmlIndex = blocks.findIndex((block) => block._type === "contentBlockHtml" && block.html?.trim());
  if (htmlIndex < 0) return blocks;
  const html = blocks[htmlIndex].html || "";
  const productsIndex = html.search(/<div\b[^>]*\bid=["']abm-category-section2["']/i);
  if (productsIndex < 0) return blocks;

  let restoredHtml = html;
  if (!/data-itsbio-packaging-intro|What Is a Viral Packaging Mix/i.test(html)) {
    restoredHtml = html.slice(0, productsIndex) + PACKAGING_INTRO + html.slice(productsIndex);
  }
  if (!/Virus Packaging DNA Mixes for Lentivirus/i.test(restoredHtml)) {
    restoredHtml = `<h2>Virus Packaging DNA Mixes for Lentivirus, Retrovirus, and AAV</h2>` + restoredHtml;
  }
  restoredHtml = restoredHtml.replace(/<table\b([^>]*\bid=["']table2["'][^>]*)>/i, (match, attributes) =>
    /data-itsbio-packaging-products/.test(match) ? match : `<table data-itsbio-packaging-products="true"${attributes}>`,
  );

  const remaining = blocks.filter((_, index) => index !== htmlIndex);
  const resources = remaining.filter((block) => block._type === "contentBlockResources").map(restoreResourceImages);
  const publications = remaining.filter((block) => block._type === "contentBlockPublications" && block.items?.length);
  const other = remaining.filter((block) => !["contentBlockResources", "contentBlockPublications", "contentBlockAbmPackagingVideo", "contentBlockAbmPackagingPublications"].includes(block._type || ""));
  return [
    { ...blocks[htmlIndex], html: restoredHtml },
    { _key: "packaging-video", _type: "contentBlockAbmPackagingVideo" },
    ...resources,
    ...(publications.length ? publications : [{ _key: "packaging-publications", _type: "contentBlockAbmPackagingPublications" }]),
    ...other,
  ];
}
