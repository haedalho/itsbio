"use client";

import { useEffect } from "react";

const PRINT_ONLY_RE = /^(?:print|print page|print this page)$/i;
const PRINT_SUFFIX_RE = /\s+Print$/i;

function collapse(value: string | null | undefined) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cleanPrintUi() {
  document.querySelectorAll<HTMLElement>(".itsbio-html a, .itsbio-html button, .itsbio-html span").forEach((element) => {
    if (PRINT_ONLY_RE.test(collapse(element.textContent))) element.remove();
  });

  document.querySelectorAll<HTMLTableCellElement>(".itsbio-html table td, .itsbio-html table th").forEach((cell) => {
    const text = collapse(cell.textContent);
    if (!PRINT_SUFFIX_RE.test(text)) return;

    const printNode = Array.from(cell.querySelectorAll<HTMLElement>("a,button,span,strong,b"))
      .find((element) => PRINT_ONLY_RE.test(collapse(element.textContent)));
    if (printNode) {
      printNode.remove();
      return;
    }

    cell.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const value = node.textContent || "";
      if (PRINT_SUFFIX_RE.test(value)) node.textContent = value.replace(PRINT_SUFFIX_RE, "");
    });

    if (PRINT_SUFFIX_RE.test(collapse(cell.textContent))) {
      cell.textContent = text.replace(PRINT_SUFFIX_RE, "").trim();
    }
  });
}

export default function AbmPrintCleanupClient() {
  useEffect(() => {
    let scheduled = false;
    const apply = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        cleanPrintUi();
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
