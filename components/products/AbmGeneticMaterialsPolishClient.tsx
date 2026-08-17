"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const GENETIC_ROOT = "/products/abm/genetic-materials";

type CanonicalNode = {
  label: string;
  aliases: string[];
  children?: CanonicalNode[];
};

function norm(value: string | null | undefined) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const node = (label: string, aliases: string[] = [], children?: CanonicalNode[]): CanonicalNode => ({
  label,
  aliases: [label, ...aliases].map(norm),
  children,
});

const OFFICIAL_GENETIC_TREE: CanonicalNode[] = [
  node("Expression-Ready Libraries", ["Expression Ready Libraries"], [
    node("Lentiviral Vectors & Virus", ["Lentiviral Vectors and Virus", "Lentiviral Vectors and Viruses"]),
    node("AAV Vectors & Virus", ["AAV Vectors and Virus", "AAV Vectors and Viruses"]),
    node("Adenovirus", ["Adenoviral Virus"]),
    node("siRNA", ["siRNA Libraries"], [
      node("siRNA Lentivirus", ["siRNA Lentiviral"]),
      node("siRNA AAV"),
      node("siRNA dsRNA Oligo", ["siRNA Oligo", "dsRNA Oligo"]),
    ]),
    node("miRNA", ["microRNA"]),
    node("ORF Vectors", ["ORF Vector"]),
    node("circRNA", ["Circular RNA"]),
    node("Control Vectors & Viruses", ["Control Vectors and Viruses", "Control Vectors"]),
  ]),
  node("CRISPR", ["CRISPR Products for Genome Editing", "CRISPR Products for Genome E"], [
    node("CRISPR KO Vectors & Virus", [
      "CRISPR KO Vectors and Virus",
      "CRISPR KO Vectors and Viruses",
      "CRISPR sgRNA Library",
      "CRISPR Knockout Library",
      "CRISPR Cas9 sgRNA Expression Vectors and Virus",
    ]),
    node("CRISPR Activation Vectors", ["CRISPR Activation", "CRISPRa Vectors"]),
    node("Cas9 Vectors & Virus", [
      "Cas9 Vectors and Virus",
      "Cas9 Vectors and Viruses",
      "Cas9 Expression Vectors and Virus",
      "Cas9 Expression Vectors and Viruses",
    ]),
    node("Cas Proteins & CRISPR Screening", ["Cas Proteins and CRISPR Screening"]),
  ]),
  node("Expression Systems", [], [
    node("Lentiviral Vectors", ["Lentivirus Expression System"]),
    node("AAV Vectors", ["AAV Expression System"]),
    node("Adenoviral Vectors", ["Adenovirus Vectors", "Adenoviral Expression Vectors"]),
    node("Retroviral Vectors", ["Retrovirus Vectors"]),
  ]),
  node("Specialized Vectors", ["Specialized Vectors & Viruses", "Specialized Vectors and Viruses"], [
    node("Targeted Cell Apoptosis Adenoviruses", ["Targeted Cell Apoptosis Adenovirus"]),
    node("iPSC Reporters", ["iPSC Reporter"]),
  ]),
  node("Kits for Viral Vectors", ["Kits Related to Recombinant Virus", "Recombinant Virus Kits"], [
    node("Virus Packaging DNA Mixes", ["Virus Packaging Mixes"]),
    node("qPCR Virus Titer Kits", ["Virus Titer Kits", "qPCR Viral Titer Kits"]),
    node("Virus Transduction Enhancer", ["Virus Transduction Enhancers"]),
    node("Virus Purification Kits", ["Virus Purification Kit"]),
    node("Lentivirus Bundles", ["Lentiviral Bundles"]),
  ]),
];

const ALL_NODES: CanonicalNode[] = [];
function flatten(nodes: CanonicalNode[]) {
  nodes.forEach((item) => {
    ALL_NODES.push(item);
    if (item.children?.length) flatten(item.children);
  });
}
flatten(OFFICIAL_GENETIC_TREE);

function anchorKey(anchor: HTMLAnchorElement) {
  let leaf = "";
  try {
    const url = new URL(anchor.getAttribute("href") || "", window.location.origin);
    leaf = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
  } catch {
    // Text matching remains available.
  }
  return [norm(anchor.textContent), norm(leaf)].filter(Boolean);
}

function matchesNode(anchor: HTMLAnchorElement, item: CanonicalNode) {
  const keys = anchorKey(anchor);
  return keys.some((value) => item.aliases.some((alias) => value === alias || value.startsWith(`${alias} `) || alias.startsWith(`${value} `)));
}

function canonicalNodeForAnchor(anchor: HTMLAnchorElement) {
  return ALL_NODES.find((item) => matchesNode(anchor, item));
}

function visibleTextElement(anchor: HTMLAnchorElement) {
  const spans = Array.from(anchor.querySelectorAll<HTMLElement>("span"))
    .filter((span) => !span.children.length && norm(span.textContent));
  const candidate = spans.find((span) => !/^[⌄⌃^›→]+$/.test((span.textContent || "").trim()));
  return candidate || null;
}

function setAnchorLabel(anchor: HTMLAnchorElement, label: string) {
  const target = visibleTextElement(anchor);
  if (target) {
    if ((target.textContent || "").trim() !== label) target.textContent = label;
  } else if (!anchor.children.length && (anchor.textContent || "").trim() !== label) {
    anchor.textContent = label;
  }
  anchor.setAttribute("title", label);
}

function orderForLabel(nodes: CanonicalNode[], label: string) {
  const wanted = norm(label);
  const index = nodes.findIndex((item) => norm(item.label) === wanted);
  return index < 0 ? 999 : index;
}

function firstAnchorLabel(element: Element) {
  const anchor = element.matches("a") ? element as HTMLAnchorElement : element.querySelector<HTMLAnchorElement>(":scope > a, a");
  return anchor ? canonicalNodeForAnchor(anchor)?.label || (anchor.textContent || "") : "";
}

function reorderDirectChildren(container: HTMLElement, nodes: CanonicalNode[]) {
  const children = Array.from(container.children);
  if (children.length < 2) return;
  const ordered = [...children].sort((a, b) => orderForLabel(nodes, firstAnchorLabel(a)) - orderForLabel(nodes, firstAnchorLabel(b)));
  ordered.forEach((child) => {
    if (container.lastElementChild !== child) container.appendChild(child);
  });
}

function normalizeGeneticNavigation() {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href^="${GENETIC_ROOT}"]`));
  anchors.forEach((anchor) => {
    const canonical = canonicalNodeForAnchor(anchor);
    if (canonical) setAnchorLabel(anchor, canonical.label);
  });

  const aside = Array.from(document.querySelectorAll<HTMLElement>("aside")).find((element) =>
    Array.from(element.querySelectorAll<HTMLAnchorElement>("a")).some((anchor) => norm(anchor.textContent) === "genetic materials"),
  );
  if (!aside) return;
  aside.classList.add("itsbio-genetic-sidebar");

  // Reorder the five official Genetic Materials groups without changing their
  // stored Sanity hrefs. The first matching list is the active root tree.
  const lists = Array.from(aside.querySelectorAll<HTMLElement>(".space-y-1"));
  const rootList = lists.find((list) => {
    const labels = Array.from(list.children).map(firstAnchorLabel).map(norm);
    return OFFICIAL_GENETIC_TREE.filter((item) => labels.includes(norm(item.label))).length >= 2;
  });
  if (rootList) reorderDirectChildren(rootList, OFFICIAL_GENETIC_TREE);

  OFFICIAL_GENETIC_TREE.forEach((parent) => {
    const parentAnchor = Array.from(aside.querySelectorAll<HTMLAnchorElement>(`a[href^="${GENETIC_ROOT}"]`))
      .find((anchor) => norm(canonicalNodeForAnchor(anchor)?.label) === norm(parent.label));
    if (!parentAnchor || !parent.children?.length) return;
    const section = parentAnchor.parentElement;
    const childList = section?.querySelector<HTMLElement>(".space-y-1");
    if (childList) reorderDirectChildren(childList, parent.children);
  });
}

function nearestSectionBoundary(start: HTMLElement) {
  const levelMatch = start.tagName.match(/^H([1-6])$/);
  const level = Number(levelMatch?.[1] || 3);
  const nodes: Element[] = [];
  let current = start.nextElementSibling;
  while (current) {
    const match = current.tagName.match(/^H([1-6])$/);
    if (match && Number(match[1]) <= level) break;
    nodes.push(current);
    current = current.nextElementSibling;
  }
  return nodes;
}

function normalizeHighlightedProducts() {
  const headings = Array.from(document.querySelectorAll<HTMLElement>(".itsbio-html h1,.itsbio-html h2,.itsbio-html h3,.itsbio-html h4"))
    .filter((heading) => norm(heading.textContent) === "highlighted products and services");

  headings.forEach((heading) => {
    if (heading.dataset.itsbioHighlightNormalized === "true") return;
    const sourceNodes = nearestSectionBoundary(heading);
    if (!sourceNodes.length) return;

    const seen = new Set<string>();
    const cards: Array<{ href: string; label: string; media: Element | null }> = [];
    sourceNodes.forEach((source) => {
      source.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const label = (anchor.textContent || "").replace(/\s*→\s*$/g, "").trim();
        if (!label || label === "→" || label.length < 3) return;
        const href = anchor.getAttribute("href") || "";
        const signature = `${href}|${norm(label)}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        const owner = anchor.closest("li,div,td") || anchor;
        const media = owner.querySelector("img,svg")?.cloneNode(true) as Element | null;
        cards.push({ href, label, media });
      });
    });
    if (cards.length < 3 || cards.length > 12) return;

    const grid = document.createElement("div");
    grid.className = "itsbio-abm-highlight-grid";
    cards.forEach((card) => {
      const link = document.createElement("a");
      link.className = "itsbio-abm-highlight-card";
      link.setAttribute("href", card.href);
      if (card.media) {
        const mediaWrap = document.createElement("span");
        mediaWrap.className = "itsbio-abm-highlight-icon";
        mediaWrap.appendChild(card.media);
        link.appendChild(mediaWrap);
      }
      const text = document.createElement("span");
      text.className = "itsbio-abm-highlight-label";
      text.textContent = card.label;
      link.appendChild(text);
      grid.appendChild(link);
    });

    sourceNodes.forEach((source) => source.remove());
    heading.insertAdjacentElement("afterend", grid);
    heading.dataset.itsbioHighlightNormalized = "true";
  });
}

export default function AbmGeneticMaterialsPolishClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith(GENETIC_ROOT)) return;
    let queued = false;
    let disposed = false;

    const apply = () => {
      if (queued || disposed) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (disposed) return;
        normalizeGeneticNavigation();
        normalizeHighlightedProducts();
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
