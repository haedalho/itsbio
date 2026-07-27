"use client";

import * as React from "react";

const PRICE_SELECTORS = [
  ".price",
  ".product-price",
  ".price-box",
  ".price-wrapper",
  ".woocommerce-Price-amount",
  ".woocommerce-price-suffix",
  ".woocommerce-variation-price",
  ".single_variation_wrap .price",
  "[itemprop='price']",
  "[data-price]",
  "[class~='amount']",
  "[class*='productPrice']",
  "[class*='product-price']",
  "[class*='price__']",
].join(",");

const PRICE_HEADER_RE = /^(?:price|unit price|list price|retail price|sale price|msrp)$/i;
const MONEY_ONLY_RE = /^(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*(?:USD|EUR|GBP|JPY|KRW))?|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))$/i;
const LOGIN_PRICE_RE = /^(?:login|sign in)\s+to\s+see\s+prices?$/i;

function removeNode(node: Element | null) {
  node?.parentElement?.removeChild(node);
}

function removePriceColumns(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    const headerRow = table.querySelector("tr");
    if (!headerRow) return;

    const headers = Array.from(headerRow.children);
    const indexes = headers
      .map((cell, index) => (PRICE_HEADER_RE.test((cell.textContent || "").replace(/\s+/g, " ").trim()) ? index : -1))
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

function removePriceNodes(root: ParentNode) {
  // Remove full table columns while the Price header still exists.
  removePriceColumns(root);

  root.querySelectorAll(PRICE_SELECTORS).forEach((node) => removeNode(node));

  root.querySelectorAll("body *").forEach((node) => {
    if (node.children.length > 0) return;
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    if (PRICE_HEADER_RE.test(text) || MONEY_ONLY_RE.test(text) || LOGIN_PRICE_RE.test(text)) {
      removeNode(node);
    }
  });
}

export default function HidePricesClient() {
  React.useEffect(() => {
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
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
