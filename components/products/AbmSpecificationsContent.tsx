"use client";

import React, { useEffect, useMemo, useState } from "react";
import { internalizeAbmHref, isOfficialAbmUrl } from "@/lib/abm/internal-links";

type Props = {
  html: string;
  baseUrl?: string;
};

function collapseWs(value: string) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function resolveUrl(value: string, baseUrl: string) {
  const href = String(value || "").trim();
  if (!href) return "";
  if (/^(?:mailto:|tel:|#)/i.test(href)) return href;
  if (/^(?:javascript:|data:|vbscript:)/i.test(href)) return "";
  try {
    return new URL(href, baseUrl || "https://www.abmgood.com").toString();
  } catch {
    return "";
  }
}

function isCommerceLabel(value: string) {
  const text = collapseWs(value);
  return /^(?:(?:unit\s+)?(?:price|cost|amount)(?:\s*(?:\(|-|:)?\s*(?:usd|cad)\)?)?|qty|quantity|cart|add\s+to\s+cart|order|msrp|retail(?:\s+price)?|wholesale(?:\s+price)?|usd|cad)$/i.test(text);
}

function isPriceOnly(value: string) {
  return /^(?:US|CA)?\$\s?\d[\d,.]*(?:\s*(?:USD|CAD))?$/i.test(collapseWs(value));
}

function sanitizeSpecifications(rawHtml: string, baseUrl: string) {
  if (!rawHtml.trim()) return "";

  const doc = new DOMParser().parseFromString(rawHtml, "text/html");

  doc
    .querySelectorAll("script,style,iframe,form,input,textarea,button,select,object,embed,meta,link")
    .forEach((node) => node.remove());

  doc.querySelectorAll<HTMLElement>("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || name === "srcdoc") element.removeAttribute(attribute.name);
      if (name === "style") element.removeAttribute(attribute.name);
      if ((name === "href" || name === "src") && /^(?:javascript:|vbscript:|data:text\/html)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = (anchor.getAttribute("href") || "").trim();
    if (/^mailto:/i.test(href)) {
      anchor.setAttribute("href", "mailto:info@itsbio.co.kr");
      if (/abmgood\.com/i.test(anchor.textContent || "")) anchor.textContent = "info@itsbio.co.kr";
      return;
    }

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) {
      anchor.removeAttribute("href");
      return;
    }

    if (isOfficialAbmUrl(resolved)) {
      const internal = internalizeAbmHref(href, baseUrl || "https://www.abmgood.com");
      if (internal) {
        anchor.setAttribute("href", internal);
        anchor.removeAttribute("target");
        anchor.removeAttribute("rel");
      } else {
        anchor.removeAttribute("href");
      }
      return;
    }

    anchor.setAttribute("href", resolved);
    if (/^https?:/i.test(resolved)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noreferrer noopener");
    }
  });

  doc.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("tr").forEach((row) => {
      const cells = Array.from(row.children).filter((cell) => cell.matches("td,th"));
      if (!cells.length) return;

      const firstLabel = collapseWs(cells[0].textContent || "");
      if (isCommerceLabel(firstLabel)) {
        row.remove();
        return;
      }

      cells.forEach((cell) => {
        if (isPriceOnly(cell.textContent || "")) cell.textContent = "";
        ["style", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "align", "valign"].forEach((attribute) =>
          cell.removeAttribute(attribute)
        );
      });

      if (cells.length === 1 && !collapseWs(cells[0].textContent || "")) row.remove();
    });

    ["style", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "align"].forEach((attribute) =>
      table.removeAttribute(attribute)
    );
  });

  doc.querySelectorAll("span.glyphicon, .abm-print-icon").forEach((node) => node.remove());

  return doc.body.innerHTML.trim();
}

const SPEC_CSS = `
.itsbio-abm-specs{font-size:14px;line-height:1.65;color:#334155}
.itsbio-abm-specs .abm-products-specification{overflow-x:auto}
.itsbio-abm-specs table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}
.itsbio-abm-specs td,.itsbio-abm-specs th{padding:13px 14px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.itsbio-abm-specs tr:last-child>td,.itsbio-abm-specs tr:last-child>th{border-bottom:0}
.itsbio-abm-specs .abm-products-specification>table>tbody>tr>td:first-child{width:170px;min-width:150px;font-weight:600;color:#111827;background:#fafafa}
.itsbio-abm-specs .abm-products-specification>table>tbody>tr>td:nth-child(2){color:#334155}
.itsbio-abm-specs p{margin:0 0 .75em}
.itsbio-abm-specs p:last-child{margin-bottom:0}
.itsbio-abm-specs ul,.itsbio-abm-specs ol{margin:.35em 0 .35em 1.25em;padding:0}
.itsbio-abm-specs ul{list-style:disc}
.itsbio-abm-specs ol{list-style:decimal}
.itsbio-abm-specs li{margin:.2em 0}
.itsbio-abm-specs a{color:#c2410c;text-decoration:underline;text-underline-offset:3px}
.itsbio-abm-specs table table{margin:.75rem 0;border-radius:8px;font-size:13px}
.itsbio-abm-specs table table th{font-weight:700;background:#f8fafc;color:#111827}
.itsbio-abm-specs table table td:first-child{width:auto;min-width:0;background:#fff;font-weight:400}
@media(max-width:640px){.itsbio-abm-specs .abm-products-specification>table>tbody>tr>td:first-child{width:120px;min-width:110px}.itsbio-abm-specs td,.itsbio-abm-specs th{padding:11px 10px}}
`;

export default function AbmSpecificationsContent({ html, baseUrl = "" }: Props) {
  const input = useMemo(() => String(html || "").trim(), [html]);
  const base = useMemo(() => String(baseUrl || "").trim(), [baseUrl]);
  const [renderHtml, setRenderHtml] = useState("");

  useEffect(() => {
    try {
      setRenderHtml(sanitizeSpecifications(input, base));
    } catch {
      setRenderHtml("");
    }
  }, [input, base]);

  if (!renderHtml) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPEC_CSS }} />
      <div className="itsbio-abm-specs" dangerouslySetInnerHTML={{ __html: renderHtml }} />
    </>
  );
}
