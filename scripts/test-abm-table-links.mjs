import assert from "node:assert/strict";

import { JSDOM } from "jsdom";

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
  <tr><td><a href="https://www.abmgood.com/Epithelial-Apoptosis-Adenovirus-G3002.html">Epithelial Apoptosis Adenovirus</a></td><td>G3002</td><td>1 x 10^6 pfu/ml</td></tr></table>
`, ["G3000", "G3001", "G3002"]);
const apoptosisLinks = [...new Set(Array.from(apoptosisVectors.querySelectorAll("tbody a")).map((anchor) => anchor.getAttribute("href")))];
assert.deepEqual(apoptosisLinks, [
  "/products/abm/staged/product/G3000?name=CMV+Control+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3001?name=Endothelial+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
  "/products/abm/staged/product/G3002?name=Epithelial+Apoptosis+Adenovirus&from=%2Fproducts%2Fabm%2Fgenetic-materials%2Fexpression-ready-libraries%2Fcontrol-vectors-and-viruses",
]);

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
