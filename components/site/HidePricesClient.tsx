"use client";

import { usePathname } from "next/navigation";
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
const PRICE_TEXT_RE = /^(?:(?:login|sign in)\s+(?:to|for)\s+(?:see\s+)?prices?|(?:call|contact us)\s+for\s+pric(?:e|ing)|price\s+on\s+request|starting\s+(?:at|from)|from\s+[$€£¥₩]|(?:price|pricing|cost|amount|msrp)\s*[:\-]|no charge)$/i;

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

    table.querySelectorAll("tr").forEach((row) => {
      const cellTexts = Array.from(row.children).map((cell) => normalizedText(cell as Element));
      if (cellTexts.some((text) => MONEY_RE.test(text) || /^no charge$/i.test(text))) {
        removeNode(row);
        return;
      }
      indexes.forEach((index) => {
        const cell = row.children[index];
        if (cell) removeNode(cell);
      });
    });
  });
}

function removePriceNodes(root: ParentNode) {
  removePriceColumns(root);
  root.querySelectorAll(PRICE_SELECTORS).forEach((node) => removeNode(node));

  root.querySelectorAll("p,li,span,small,strong,td,th").forEach((node) => {
    if (node.children.length > 0) return;
    const text = normalizedText(node as Element);
    if (text && (MONEY_RE.test(text) || PRICE_TEXT_RE.test(text))) removeNode(node as Element);
  });
}

export default function HidePricesClient() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!pathname.startsWith("/products")) return;

    const frame = window.requestAnimationFrame(() => removePriceNodes(document));
    const delayed = window.setTimeout(() => removePriceNodes(document), 250);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
    };
  }, [pathname]);

  return null;
}
