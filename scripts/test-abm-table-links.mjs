import assert from "node:assert/strict";

import { JSDOM } from "jsdom";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const pageUrl = "https://www.itsbio.co.kr/products/abm/genetic-materials/expression-ready-libraries/control-vectors-and-viruses";
const browser = new JSDOM("<!doctype html><html><body></body></html>", { url: pageUrl });

Object.assign(globalThis, {
  window: browser.window,
  document: browser.window.document,
  DOMParser: browser.window.DOMParser,
  Element: browser.window.Element,
  HTMLElement: browser.window.HTMLElement,
  HTMLAnchorElement: browser.window.HTMLAnchorElement,
  HTMLTableElement: browser.window.HTMLTableElement,
  HTMLTableRowElement: browser.window.HTMLTableRowElement,
});

const { sanitizeAndStyle } = await import("../components/site/HtmlContent.tsx");
const { extractAbmTableCatalogNumbers } = await import("../lib/abm/table-catalog.ts");
const { restorePackagingMixesBlocks } = await import("../lib/abm/packaging-mixes.ts");

function render(html, products = [], services = []) {
  return new JSDOM(sanitizeAndStyle(html, "https://www.abmgood.com", "abm-landing", products, services)).window.document;
}

assert.deepEqual(extractAbmTableCatalogNumbers(`
  <table><tr><th>Product Name</th><th>Cat.No.</th></tr>
  <tr><td>Missing vector</td><td>CIR001</td></tr>
  <tr><td>AAV control</td><td>By Serotype</td></tr></table>
`), ["CIR001"]);

const known = render(`
  <table><tr><th>Product Name</th><th>Cat.No.</th></tr>
  <tr><td>Known vector</td><td>K002</td></tr></table>
`, ["K002"]);
assert.equal(
  known.querySelector("td a")?.getAttribute("href"),
  "/products/abm/staged/product/K002?name=Known+vector&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
);

const missing = render(`
  <table><tr><th>Product Name</th><th>Cat.No.</th></tr>
  <tr><td><a href="/products/abm/resolve?title=Missing&amp;u=https%3A%2F%2Fwww.abmgood.com%2Fmissing.html">Missing vector</a></td>
  <td><a href="https://www.abmgood.com/missing.html">CIR001</a></td></tr></table>
`);
assert.equal(missing.querySelector("tr[data-abm-unresolved-sku='CIR001']") !== null, true);
assert.equal(missing.querySelector("td:nth-child(1) a")?.getAttribute("href")?.includes("u="), true);
assert.equal(missing.querySelector("td:nth-child(2) a"), null);

const missingCloningVector = render(`
  <table><tr><th>Cloning Vector</th><th>Cat. No.</th><th>Promoter</th></tr>
  <tr><td><a href="https://www.abmgood.com/vector/pAdeno">pAdeno</a></td>
  <td><a href="/products/abm/resolve?sku=A001">A001</a></td><td>CMV</td></tr></table>
`);
assert.equal(missingCloningVector.querySelector("td:nth-child(1) a")?.getAttribute("href"), "https://www.abmgood.com/vector/pAdeno");
assert.equal(missingCloningVector.querySelector("td:nth-child(2) a"), null);

const restoredCloningVector = render(`
  <table><tr><th>Cloning Vector</th><th>Cat. No.</th><th>Tag/Marker</th></tr>
  <tr><td><a href="https://www.abmgood.com/vector/pLenti-III-HA">pLenti-III-HA</a></td>
  <td><a href="https://www.abmgood.com/lenti-iii-ha-expression-vector-lv022.html">LV022</a></td><td>C-His, Puro</td></tr></table>
`, ["LV022"]);
assert.equal(restoredCloningVector.querySelector("td:nth-child(1) a")?.getAttribute("href"), "https://www.abmgood.com/vector/pLenti-III-HA");
assert.equal(
  restoredCloningVector.querySelector("td:nth-child(2) a")?.getAttribute("href"),
  "/products/abm/staged/product/LV022?name=pLenti-III-HA&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
);

const option = render(`
  <table><tr><th>Product Name</th><th>Cat.No.</th></tr>
  <tr><td>AAV control</td><td><a href="/products/abm/resolve?sku=By+Serotype">By Serotype</a></td></tr></table>
`);
assert.equal(option.querySelector("td:nth-child(2) a"), null);
assert.equal(option.querySelector("td:nth-child(2)")?.textContent?.trim(), "By Serotype");

const apoptosisVectors = render(`
  <table><tr><th>Product Name</th><th>Cat. No.</th><th>Titer</th></tr>
  <tr><td><a href="https://www.abmgood.com/CMV-Control-Apoptosis-Adenovirus-G3000.html">CMV Control Apoptosis Adenovirus</a></td><td>G3000</td><td>1 x 10^6 pfu/ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/Endothelial-Apoptosis-Adenovirus-G3001.html">Endothelial Apoptosis Adenovirus</a></td><td>G3001</td><td>1 x 10^6 pfu/ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/Epithelial-Apoptosis-Adenovirus-G3002.html">Epithelial Apoptosis Adenovirus</a></td><td>G3002</td><td>1 x 10^6 pfu/ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/Astrocyte-Apoptosis-Adenovirus-G3003.html">Astrocyte Apoptosis Adenovirus</a></td><td>G3003</td><td>1 x 10^6 pfu/ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/Fibroblast-Apoptosis-Adenovirus-G3004.html">Fibroblast Apoptosis Adenovirus</a></td><td>G3004</td><td>1 x 10^6 pfu/ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/Microglia-Apoptosis-Adenovirus-G3005.html">Microglia Apoptosis Adenovirus</a></td><td>G3005</td><td>1 x 10^6 pfu/ml</td></tr></table>
`, ["G3000", "G3001", "G3002", "G3003", "G3004", "G3005"]);
const apoptosisLinks = [...new Set(Array.from(apoptosisVectors.querySelectorAll("tbody a")).map((anchor) => anchor.getAttribute("href")))];
assert.deepEqual(apoptosisLinks, [
  "/products/abm/staged/product/G3000?name=CMV+Control+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3001?name=Endothelial+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3002?name=Epithelial+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3003?name=Astrocyte+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3004?name=Fibroblast+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3005?name=Microglia+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
]);

const ipscReporters = render(`
  <table><tr><th>Product Name</th><th>Cat. No.</th><th>Quantity</th></tr>
  <tr><td><a href="https://www.abmgood.com/oct4-ecfp-reporter-adenovirus.html">Oct4 ECFP Reporter Adenovirus</a></td><td>000776A</td><td>1.0 ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/myc-eyfp-reporter-adenovirus.html">Myc EYFP Reporter Adenovirus</a></td><td>000774A</td><td>1.0 ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/eos-c-3-eip-adenovirus.html">EOS-C (3+)-EiP Adenovirus</a></td><td>000834A</td><td>1.0 ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/eos-s-4-eip-adenovirus.html">EOS-S (4+)-EiP Adenovirus</a></td><td>000835A</td><td>1.0 ml</td></tr>
  <tr><td><a href="https://www.abmgood.com/eos-lentiviral-vector-pl-sin-eos-c3-eip-lv028858.html">EOS Lentiviral Vector (PL-SIN-EOS-C(3)-EiP)</a></td><td>LV028858</td><td>1.0 µg DNA</td></tr>
  <tr><td><a href="https://www.abmgood.com/eos-lentiviral-vector-pl-sin-eos-s4-eip-lv028859.html">EOS Lentiviral Vector (PL-SIN-EOS-S(4)-EiP)</a></td><td>LV028859</td><td>1.0 µg DNA</td></tr></table>
`, ["000776A", "000774A", "000834A", "000835A", "LV028858", "LV028859"]);
const ipscSkus = ["000776A", "000774A", "000834A", "000835A", "LV028858", "LV028859"];
const ipscRows = Array.from(ipscReporters.querySelectorAll("tbody tr")).filter((row) => row.querySelector("td"));
assert.equal(ipscRows.length, ipscSkus.length);
ipscRows.forEach((row, index) => {
  const nameLink = row.querySelector("td:nth-child(1) a")?.getAttribute("href");
  const skuLink = row.querySelector("td:nth-child(2) a")?.getAttribute("href");
  assert.ok(nameLink?.startsWith(`/products/abm/staged/product/${ipscSkus[index]}?`));
  assert.equal(skuLink, nameLink, `iPSC product name and catalog number must route to the same detail for ${ipscSkus[index]}`);
});

const lentivirusBundlesHtml = `
  <table>
    <thead><tr><th>Product Name</th><th>Quantity</th><th></th><th></th><th>Bundle 1</th><th>Bundle 2</th><th>Individual Cat. No.</th></tr></thead>
    <tbody>
      <tr><td></td><td>Bundle Cat. No.</td>
        <td><a href="https://www.abmgood.com/qPCR-Lentivirus-Titer-Kit-ViralEntry-Bundle-LV900-G515.html">LV900-G515</a></td>
        <td><a href="https://www.abmgood.com/2nd-generation-packaging-mix-dnafectin-LV003-G2500.html">LV003-G2500</a></td>
        <td><a href="https://www.abmgood.com/2nd-Generation-Lentivirus-Bundle-1.html">Lenti-Bundle-1</a></td>
        <td><a href="https://www.abmgood.com/2nd-Generation-Lentivirus-Bundle-2.html">Lenti-Bundle-2</a></td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <table>
    <thead><tr><th>Product Name</th><th>Quantity</th><th></th><th></th><th>Bundle 3</th><th>Bundle 4</th><th>Individual Cat. No.</th></tr></thead>
    <tbody>
      <tr><td></td><td>Bundle Cat. No.</td>
        <td><a href="https://www.abmgood.com/qPCR-Lentivirus-Titer-Kit-ViralEntry-Bundle-LV900-G515.html">LV900-G515</a></td>
        <td><a href="https://www.abmgood.com/3rd-generation-packaging-mix-dnafectin-LV053-G2500.html">LV053-G2500</a></td>
        <td><a href="https://www.abmgood.com/3rd-Generation-Lentivirus-Bundle-3.html">Lenti-Bundle-3</a></td>
        <td><a href="https://www.abmgood.com/3rd-Generation-Lentivirus-Bundle-4.html">Lenti-Bundle-4</a></td>
        <td></td>
      </tr>
    </tbody>
  </table>
`;
assert.deepEqual(extractAbmTableCatalogNumbers(lentivirusBundlesHtml), [
  "LV900-G515",
  "LV003-G2500",
  "Lenti-Bundle-1",
  "Lenti-Bundle-2",
  "LV053-G2500",
  "Lenti-Bundle-3",
  "Lenti-Bundle-4",
]);

const lentivirusBundles = render(lentivirusBundlesHtml, [
  "LV900-G515",
  "LV003-G2500",
  "Lenti-Bundle-1",
  "Lenti-Bundle-2",
  "LV053-G2500",
  "Lenti-Bundle-3",
  "Lenti-Bundle-4",
]);
const bundleStagedLinks = Array.from(lentivirusBundles.querySelectorAll("tbody a"))
  .map((anchor) => anchor.getAttribute("href"))
  .filter((href) => href?.startsWith("/products/abm/staged/product/"));
assert.equal(new Set(bundleStagedLinks).size, 7);

// Reproduce the migrated matrices: two blank but populated combo headers,
// nested source text colors, and a sparse footer left after price stripping.
for (const generation of [2, 3]) {
  const packagingSku = generation === 2 ? "LV003" : "LV053";
  const firstBundle = generation === 2 ? 1 : 3;
  const packageSkus = ["LV900-G515", `${packagingSku}-G2500`, `Lenti-Bundle-${firstBundle}`, `Lenti-Bundle-${firstBundle + 1}`];
  const checkRows = [
    ["Packaging Mix", "100 μg", "", "✔", "✔", "✔", packagingSku, ""],
    ["DNAfectin Plus", "1.0 ml", "", "✔", "✔", "✔", "G2500", ""],
    ["qPCR Lentivirus Titer Kit", "100 rxn", "✔", "", "✔", "✔", "LV900", ""],
    ["ViralEntry Transduction Enhancer", "1.0 ml", "✔", "", "", "✔", "G515", ""],
  ];
  const matrixHtml = `<table><thead><tr>
    <th>Product Name</th><th>Quantity</th><th></th><th></th>
    <th>Bundle ${firstBundle}</th><th>Bundle ${firstBundle + 1}<br><span style="color:black;background:yellow">Best Value</span></th>
    <th><span style="color:#7e8c8d">Individual Cat. No.</span></th><th>Individual Price</th>
    </tr></thead><tbody>
    ${checkRows.map((cells) => `<tr>${cells.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("")}
    <tr><td></td><td><span style="color:white">Bundle Cat. No.</span></td>
    ${packageSkus.map((sku) => `<td>${sku}</td>`).join("")}<td></td><td></td></tr>
    <tr><td></td><td><span style="color:white">Bundle Price</span></td><td></td><td></td></tr>
    </tbody></table>`;

  for (const mode of ["abm-landing", "abm-detail"]) {
    const matrix = new JSDOM(sanitizeAndStyle(matrixHtml, "https://www.abmgood.com", mode, packageSkus)).window.document;
    const table = matrix.querySelector("table[data-itsbio-bundle-table]");
    assert.ok(table, `${generation}nd/rd generation matrix is recognized in ${mode}`);
    assert.deepEqual(Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent.trim()), [
      "Product Name", "Quantity", packageSkus[0], packageSkus[1], `Bundle ${firstBundle}`, `Bundle ${firstBundle + 1}Best Value`, "Individual Cat. No.",
    ]);
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    assert.equal(bodyRows.length, 5);
    bodyRows.slice(0, 4).forEach((row, index) => {
      assert.deepEqual(Array.from(row.cells).map((cell) => cell.textContent.trim()), checkRows[index].slice(0, 7));
    });
    const catalogRow = bodyRows[4];
    assert.equal(catalogRow.cells[0].colSpan, 2);
    assert.equal(catalogRow.cells[0].textContent.trim(), "Bundle Cat. No.");
    assert.equal(catalogRow.querySelector("[style]"), null);
    assert.equal(Array.from(catalogRow.cells).reduce((sum, cell) => sum + cell.colSpan, 0), 7);
    assert.deepEqual(Array.from(catalogRow.querySelectorAll("a")).map((link) => link.getAttribute("href").split("?")[0]),
      packageSkus.map((sku) => `/products/abm/staged/product/${sku}`));
    assert.equal(/price/i.test(table.textContent), false);
  }
}

const viralKitProducts = [
  ["2nd Generation Packaging Mix", "LV003"],
  ["2nd Gen. Packaging Mix & DNAfectin Plus Combo Pack", "LV003-G2500"],
  ["3rd Generation Packaging Mix", "LV053"],
  ["3rd Gen. Packaging Mix & DNAfectin Plus Combo Pack", "LV053-G2500"],
  ["Retrovirus Packaging Mix", "E-510"],
  ["AAV Packaging Mix (Serotype 1)", "AAV1001"],
  ["AAV Packaging Mix (Serotype 2)", "AAV1002"],
  ["AAV Packaging Mix (Serotype 3)", "AAV1003"],
  ["AAV Packaging Mix (Serotype 4)", "AAV1004"],
  ["AAV Packaging Mix (Serotype 5)", "AAV1005"],
  ["AAV Packaging Mix (Serotype 6)", "AAV1006"],
  ["qPCR Lentivirus Titer Kit", "LV900"],
  ["qPCR AAV Titer Kit", "G931"],
  ["qPCR Retrovirus Titer Kit", "G949"],
  ["ViralEntry Transduction Enhancer", "G515"],
  ["AAViralEntry Transduction Enhancer", "G516"],
  ["Ultra-Pure Lentivirus Purification Kit", "LV998"],
  ["Speedy Lentivirus Purification Kit", "LV999"],
];
const viralKitHtml = `
  <table>
    <tr><th>Product Name</th><th>Cat. No.</th><th>Size</th></tr>
    ${viralKitProducts.map(([name, sku]) => `<tr><td><a href="https://www.abmgood.com/${sku}.html">${name}</a></td><td>${sku}</td><td>1</td></tr>`).join("")}
  </table>
`;
const viralKitDoc = render(viralKitHtml, viralKitProducts.map(([, sku]) => sku));
for (const [, sku] of viralKitProducts) {
  const row = Array.from(viralKitDoc.querySelectorAll("tr")).find((candidate) =>
    candidate.textContent?.includes(sku),
  );
  assert.ok(row, `missing rendered viral kit row ${sku}`);
  const hrefs = Array.from(row.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href") || "");
  assert.equal(
    hrefs.some((href) => href.startsWith(`/products/abm/staged/product/${encodeURIComponent(sku)}`)),
    true,
    `viral kit ${sku} did not route to staged detail`,
  );
}

const enhancerImages = Array.from({ length: 11 }, (_, index) => `<img src="https://cdn.sanity.io/images/9b5twpc8/production/enhancer-${index}.png">`);
const enhancerHtml = `
  <div style="text-align:center">${enhancerImages[0]}</div>
  <div id="ProductList"><table><thead><tr><th>Product Name</th><th>Cat. No.</th><th>Application</th><th>Size</th><th>Price</th></tr></thead><tbody>
  <tr><td>ViralEntry Transduction Enhancer</td><td>G515</td><td>Lentivirus</td><td>1.0 ml</td><td>$185</td></tr>
  <tr><td>AAViralEntry Transduction Enhancer</td><td>G516</td><td>AAV</td><td>1.0 ml</td><td>$185</td></tr></tbody></table></div>
  <div id="ViralEntry"><p>Lentivirus results</p>${enhancerImages.slice(1, 6).join("")}</div>
  <div id="AAViralEntry"><p>AAV results</p>${enhancerImages.slice(6).join("")}</div>
  <div id="free_sample"><h3>Request a Free Sample</h3><p>Use the form below</p><form><input></form></div>
`;
for (const mode of ["abm-landing", "abm-detail"]) {
  const enhancer = new JSDOM(sanitizeAndStyle(enhancerHtml, "https://www.abmgood.com", mode, ["G515", "G516"])).window.document;
  assert.equal(enhancer.querySelectorAll("img").length, 11, "enhancer polish preserves all source images");
  assert.equal(enhancer.querySelector("img")?.classList.contains("itsbio-enhancer-guarantee"), true);
  assert.equal(enhancer.querySelectorAll("table[data-itsbio-enhancer-table] thead th").length, 4);
  assert.equal(enhancer.querySelector("#free_sample"), null, "do not retain instructions for a stripped sample form");
  assert.equal(enhancer.querySelector("#ViralEntry p")?.textContent, "Lentivirus results");
  assert.equal(enhancer.querySelector("#AAViralEntry p")?.textContent, "AAV results");
  assert.equal(enhancer.querySelectorAll("tbody a").length, 4);
}
const unrelatedSample = render(`<div id="free_sample"><p>Unrelated category content</p></div>`);
assert.equal(unrelatedSample.querySelector("#free_sample")?.textContent, "Unrelated category content");

const packagingPath = "genetic-materials/kits-for-viral-vectors/virus-packaging-dna-mixes";
const packagingSkus = ["LV003", "LV003-G2500", "LV053", "LV053-G2500", "E-510", "AAV1001", "AAV1002", "AAV1003", "AAV1004", "AAV1005", "AAV1006"];
const packagingBlocks = [
  { _key: "html", _type: "contentBlockHtml", html: `<p>Existing overview</p><div id="abm-category-section2"><h3>Products</h3><table id="table2"><thead><tr><th>Product Name</th><th>Cat. No.</th><th>Price</th></tr></thead><tbody>${packagingSkus.map(sku => `<tr><td>Product ${sku}</td><td>${sku}</td><td>$10</td></tr>`).join("")}</tbody></table></div>` },
  { _key: "resources", _type: "contentBlockResources", items: [{ title: "Existing resource", href: "https://info.abmgood.com/lentivirus" }] },
];
const restoredPackaging = restorePackagingMixesBlocks(packagingPath, packagingBlocks);
assert.deepEqual(restoredPackaging.map(block => block._type), ["contentBlockHtml", "contentBlockAbmPackagingVideo", "contentBlockResources", "contentBlockAbmPackagingPublications"]);
assert.deepEqual(restorePackagingMixesBlocks(packagingPath, restoredPackaging), restoredPackaging, "restoration does not duplicate sections");
assert.equal(restorePackagingMixesBlocks("genetic-materials/crispr", packagingBlocks), packagingBlocks, "other categories retain their content");
assert.equal(restoredPackaging[2], packagingBlocks[1], "the resource record is retained");
const resourceDestinations = ["crispr-cas9-introduction", "lentivirus-system", "adeno-associated-virus-aav", "adenovirus-system"];
const missingResourceBanners = restorePackagingMixesBlocks(packagingPath, [packagingBlocks[0], {
  _type: "contentBlockResources", items: resourceDestinations.map(path => ({ title: path, href: `https://info.abmgood.com/${path}` })),
}])[2];
assert.equal(missingResourceBanners.items.filter(item => item.imageUrl.startsWith("https://cdn.sanity.io/images/")).length, 4);
assert.deepEqual(missingResourceBanners.items.map(item => item.href), resourceDestinations.map(path => `https://info.abmgood.com/${path}`));
assert.equal(missingResourceBanners.items.every(item => item.imageFit === "contain"), true);
assert.equal(packagingBlocks[0].html.includes("data-itsbio-packaging-intro"), false, "the CMS input is not mutated");
const restoredPackagingDoc = render(restoredPackaging[0].html, packagingSkus);
assert.equal(restoredPackagingDoc.querySelector("details summary")?.textContent, "What Is a Viral Packaging Mix? ↓ (Click to expand)");
assert.equal(restoredPackagingDoc.querySelectorAll("table[data-itsbio-packaging-comparison] tbody tr").length, 5);
assert.equal(restoredPackagingDoc.querySelectorAll("table[data-itsbio-packaging-products] tbody tr").length, 11);
assert.equal(restoredPackagingDoc.querySelectorAll("table[data-itsbio-packaging-products] thead th").length, 2);
assert.equal(restoredPackagingDoc.querySelectorAll("table[data-itsbio-packaging-products] a").length, 22);
assert.match(restoredPackagingDoc.querySelector(".itsbio-packaging-workflow img")?.src, /35da2c880ee0ab3fe32ab098fd65f40934f3dc96/);

// Standalone JSX rendering uses the same components as the category route.
globalThis.React = React;
const guideModule = await import("../components/products/AbmViralKitGuide.tsx");
const Guide = guideModule.default.default || guideModule.default;
const titerModule = await import("../components/products/AbmTiterKitLanding.tsx");
const TiterLanding = titerModule.default.default || titerModule.default;
const titerDoc = new JSDOM(renderToStaticMarkup(React.createElement(TiterLanding))).window.document;
assert.deepEqual(Array.from(titerDoc.querySelectorAll("table thead th"), cell => cell.textContent), ["Product", "Cat. No.", "Viral System", "Method", "Size"]);
assert.deepEqual(Array.from(titerDoc.querySelectorAll("table tbody tr"), row => Array.from(row.cells, cell => cell.textContent)), [
  ["qPCR Lentivirus Titer Kit", "LV900", "Lentivirus", "RT-qPCR", "100 rxn"],
  ["qPCR AAV Titer Kit", "G931", "AAV", "qPCR", "100 rxn"],
  ["qPCR Retrovirus Titer Kit", "G949", "Retrovirus", "RT-qPCR", "100 rxn"],
]);
assert.equal(titerDoc.querySelectorAll("details").length, 6);
assert.equal(titerDoc.querySelectorAll("figure img").length, 3);
assert.equal(titerDoc.querySelectorAll("img").length, 5);
assert.equal(titerDoc.querySelectorAll('a[href^="https://doi.org/"]').length, 3);
assert.equal(titerDoc.querySelectorAll('a[href^="/products/abm/staged/product/"]').length, 12);
for (const anchor of titerDoc.querySelectorAll('a[href^="#"]')) {
  assert.ok(titerDoc.getElementById(anchor.getAttribute("href").slice(1)), "in-page navigation has a destination");
}
assert.equal(renderToStaticMarkup(React.createElement(Guide, { path: titerModule.TITER_PATH, position: "before", sourceHtml: "" })), "", "the obsolete titer comparison is removed");
assert.equal(renderToStaticMarkup(React.createElement(Guide, { path: titerModule.TITER_PATH, position: "after", sourceHtml: "" })), "", "the obsolete titer FAQ is removed");
const mediaModule = await import("../components/products/AbmPackagingMedia.tsx");
const packagingFaq = new JSDOM(renderToStaticMarkup(React.createElement(Guide, { path: packagingPath, position: "after", sourceHtml: restoredPackaging[0].html }))).window.document;
assert.equal(packagingFaq.querySelectorAll("details").length, 20, "all supplier FAQ topics are represented");
const packagingVideo = new JSDOM(renderToStaticMarkup(React.createElement(mediaModule.AbmPackagingVideo))).window.document;
assert.equal(packagingVideo.querySelector("iframe")?.src, "https://www.youtube.com/embed/LzgsgVO5WYI");
const packagingPubs = new JSDOM(renderToStaticMarkup(React.createElement(mediaModule.AbmPackagingPublications))).window.document;
assert.equal(packagingPubs.querySelectorAll("article").length, 3);
assert.equal(packagingPubs.querySelectorAll('a[href^="https://doi.org/"]').length, 3);

const cas9 = render(`
  <h1>Cas9 Expression Vectors and Viruses</h1>
  <table><tr><th>Product Name</th><th>Vector Map</th><th>Cat.No.</th></tr>
  <tr><td><a href="https://www.abmgood.com/CRISPR-Knockout-Lentivirus-Library.html">All-in-One</a></td>
  <td><a href="https://www.abmgood.com/vector/pLenti-U6-sgRNA">View</a></td>
  <td><a href="https://www.abmgood.com/crispr-knockout-library.html">C442</a></td></tr>
  <tr><td><a href="https://www.abmgood.com/Custom-Multiplex-sgRNA-Vector.html">Multiplexed sgRNAs</a></td>
  <td><a href="https://www.abmgood.com/vector/pLenti-Multi-sgRNA-PGK-Neo">View</a></td>
  <td><a href="/products/abm/resolve?sku=C420">C420</a></td></tr></table>
`, [], ["C442"]);
const cas9Links = Array.from(cas9.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href"));
assert.equal(cas9Links[0]?.startsWith("/products/abm/legacy?u="), true);
assert.equal(cas9Links[1], "https://www.abmgood.com/vector/pLenti-U6-sgRNA");
assert.equal(cas9Links[2], "/products/abm/genetic-materials/crispr/crispr-ko-vectors-and-virus");
assert.equal(cas9Links[3]?.includes("Custom-Multiplex-sgRNA-Vector.html"), true);
assert.equal(cas9Links[4], "https://www.abmgood.com/vector/pLenti-Multi-sgRNA-PGK-Neo");
assert.equal(cas9Links[5], cas9Links[3]);

console.log("ABM vector table link regression checks passed.");
