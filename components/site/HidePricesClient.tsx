"use client";

import * as React from "react";

const PRICE_SELECTORS = [
  ".price",
  ".pricing",
  ".product-price",
  ".product_price",
  ".price-box",
  ".price-wrapper",
  ".regular-price",
  ".sale-price",
  ".list-price",
  ".retail-price",
  ".unit-price",
  ".msrp",
  ".woocommerce-Price-amount",
  ".woocommerce-price-suffix",
  ".woocommerce-variation-price",
  ".single_variation_wrap .price",
  "[itemprop='price']",
  "[class~='amount']",
  "[class*='productPrice']",
  "[class*='product-price']",
  "[class*='price__']",
  "[class*='__price']",
].join(",");

const PRICE_HEADER_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;
const MONEY_RE = /(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*(?:USD|EUR|GBP|JPY|KRW))?|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/i;
const PRICE_TEXT_RE = /^(?:(?:login|sign in)\s+(?:to|for)\s+(?:see\s+)?prices?|(?:call|contact us)\s+for\s+pric(?:e|ing)|price\s+on\s+request|starting\s+(?:at|from)|from\s+[$€£¥₩]|(?:price|pricing|cost|amount|msrp)\s*[:\-])/i;

function removeNode(node: Element | null) {
  node?.parentElement?.removeChild(node);
}

function normalizedText(node: Element) {
  return (node.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function removePriceColumns(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    const headerRow = table.querySelector("thead tr") || table.querySelector("tr");
    if (!headerRow) return;

    const indexes = Array.from(headerRow.children)
      .map((cell, index) => (PRICE_HEADER_RE.test(normalizedText(cell as Element)) ? index : -1))
      .filter((index) => index >= 0)
      .sort((a, b) => b - a);

    if (!indexes.length) return;

    table.querySelectorAll("tr").forEach((row) => {
      indexes.forEach((index) => {
        const cell = row.children[index];
        if (cell) removeNode(cell);
      });
    });
  });
}

function removeTextPriceNode(node: Element) {
  const text = normalizedText(node);
  if (!text || (!MONEY_RE.test(text) && !PRICE_TEXT_RE.test(text))) return;

  const tag = node.tagName.toLowerCase();
  if (["td", "th", "p", "li", "small", "strong"].includes(tag)) {
    removeNode(node);
    return;
  }

  const parent = node.parentElement;
  if (parent && ["td", "th", "p", "li"].includes(parent.tagName.toLowerCase())) {
    const parentText = normalizedText(parent);
    if (MONEY_RE.test(parentText) || PRICE_TEXT_RE.test(parentText)) {
      removeNode(parent);
      return;
    }
  }

  removeNode(node);
}

function removeEmptyPriceFragments(root: ParentNode) {
  root.querySelectorAll("p,li,span,small,strong,td,th").forEach((node) => {
    if (node.querySelector("img,video,iframe,table,a[href],button,input,select")) return;
    if (!normalizedText(node as Element)) removeNode(node as Element);
  });
}

function removePriceNodes(root: ParentNode) {
  removePriceColumns(root);
  root.querySelectorAll(PRICE_SELECTORS).forEach((node) => removeNode(node));

  root.querySelectorAll("body *").forEach((node) => {
    if (node.children.length > 0) return;
    removeTextPriceNode(node as Element);
  });

  removeEmptyPriceFragments(root);
}

export default function HidePricesClient() {
  React.useEffect(() => {
    if (!window.location.pathname.startsWith("/products")) return;

    let queued = false;
    const run = () => {
      queued = false;
      removePriceNodes(document);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(run);
    };

    run();
    const observer = new MutationObserver(queue);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "itemprop"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
