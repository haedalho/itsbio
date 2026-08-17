import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import Breadcrumb from "@/components/site/Breadcrumb";
import {
  ABM_GENETIC_OFFICIAL_TREE,
  geneticNodeMatches,
  normalizeGeneticLabel,
  type GeneticOfficialNode,
} from "@/lib/abm/genetic-materials-official";
import { ABM_SERVICE_GROUPS, abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

export const revalidate = 300;

const ROOT = "genetic-materials";
const ROOT_PATH = [ROOT];
const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";
const CONTENT_LAYOUT = "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]";

type CategoryDoc = {
  _id: string;
  title?: string;
  path: string[];
  sourceUrl?: string;
  order?: number;
};

type ResolvedNode = {
  node: GeneticOfficialNode;
  doc?: CategoryDoc;
  href?: string;
  children: ResolvedNode[];
};

const QUERY = `*[
  _type == "category"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == "abm"
    || themeKey == "abm"
    || brand->themeKey == "abm"
    || brand->slug.current == "abm"
  )
  && defined(path)
  && path[0] == "genetic-materials"
]
| order(count(path) asc, order asc, title asc) {
  _id,
  title,
  path,
  sourceUrl,
  order
}`;

function hrefForPath(path: string[]) {
  return `/products/abm/${path.map(encodeURIComponent).join("/")}`;
}

function prefixMatches(path: string[], parentPath: string[]) {
  return parentPath.every((segment, index) => path[index] === segment);
}

function matchScore(node: GeneticOfficialNode, doc: CategoryDoc) {
  const title = normalizeGeneticLabel(doc.title || "");
  const leaf = normalizeGeneticLabel(doc.path.at(-1) || "");
  const aliases = node.aliases.map(normalizeGeneticLabel);
  if (aliases.includes(title) || aliases.includes(leaf)) return 100;
  if (geneticNodeMatches(node, doc.title, doc.path.at(-1))) return 70;
  return 0;
}

function findDoc(node: GeneticOfficialNode, docs: CategoryDoc[], parentPath: string[]) {
  const descendants = docs.filter((doc) => doc.path.length > parentPath.length && prefixMatches(doc.path, parentPath));
  const direct = descendants.filter((doc) => doc.path.length === parentPath.length + 1);
  const pool = direct.length ? direct : descendants;
  return pool
    .map((doc) => ({ doc, score: matchScore(node, doc) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.path.length - b.doc.path.length)[0]?.doc;
}

function resolveTree(nodes: GeneticOfficialNode[], docs: CategoryDoc[], parentPath = ROOT_PATH): ResolvedNode[] {
  return nodes.map((node) => {
    const doc = findDoc(node, docs, parentPath);
    const nextParent = doc?.path || parentPath;
    return {
      node,
      doc,
      href: doc ? hrefForPath(doc.path) : undefined,
      children: resolveTree(node.children || [], docs, nextParent),
    };
  });
}

function flattenResolved(nodes: ResolvedNode[]) {
  const out: ResolvedNode[] = [];
  const visit = (items: ResolvedNode[]) => {
    items.forEach((item) => {
      out.push(item);
      visit(item.children);
    });
  };
  visit(nodes);
  return out;
}

function isOnTrail(currentPath: string[], nodePath?: string[]) {
  if (!nodePath?.length) return false;
  return nodePath.every((segment, index) => currentPath[index] === segment);
}

function OfficialSideNav({ tree, activePath }: { tree: ResolvedNode[]; activePath: string[] }) {
  const renderNodes = (nodes: ResolvedNode[], depth = 0) => (
    <div className={depth ? "ml-3 border-l border-orange-100 pl-2" : "space-y-1"}>
      {nodes.map((item) => {
        const exact = !!item.doc && activePath.join("/") === item.doc.path.join("/");
        const trail = !!item.doc && isOnTrail(activePath, item.doc.path);
        const open = item.children.length > 0 && trail;
        const classes = exact
          ? "bg-orange-50 font-semibold text-[#dc5a2b]"
          : trail
            ? "font-semibold text-[#dc5a2b]"
            : "text-neutral-800 hover:bg-neutral-50 hover:text-[#dc5a2b]";

        return (
          <div key={`${depth}-${item.node.key}`}>
            {item.href ? (
              <Link href={item.href} prefetch={false} className={`flex items-start justify-between gap-2 px-2 py-1.5 text-sm leading-5 transition ${classes}`}>
                <span>{item.node.label}</span>
                <span className="shrink-0 text-neutral-300" aria-hidden>{item.children.length ? (open ? "⌃" : "⌄") : "›"}</span>
              </Link>
            ) : (
              <div className="flex items-start justify-between gap-2 px-2 py-1.5 text-sm leading-5 text-neutral-400">
                <span>{item.node.label}</span><span aria-hidden>·</span>
              </div>
            )}
            {open ? renderNodes(item.children, depth + 1) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <nav className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm" aria-label="ABM Genetic Materials">
      <div className="border-b border-neutral-200 bg-neutral-100 px-5 py-3">
        <div className="text-xl font-bold text-[#dc5a2b]">All Products</div>
      </div>
      <div className="p-3">
        <Link href="/products/abm/genetic-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-[#dc5a2b]">
          <span>Genetic Materials</span><span aria-hidden>⌃</span>
        </Link>
        {renderNodes(tree)}
        <div className="mt-2 border-t border-neutral-200 pt-2">
          <Link href="/products/abm/cellular-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]">
            <span>Cellular Materials</span><span aria-hidden>⌄</span>
          </Link>
          <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]">
            <span>General Materials</span><span aria-hidden>⌄</span>
          </Link>
        </div>
        <div className="mt-3 border-t border-neutral-200 pt-3">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Services</div>
          {ABM_SERVICE_GROUPS.map((group) => (
            <Link key={group.slug} href={group.href} className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]">
              <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function CatalogSearch({ prompt }: { prompt: string }) {
  return (
    <section className="mt-8 rounded-2xl border border-orange-200 bg-orange-50/40 p-5 md:p-6" aria-label="ABM catalog search">
      <p className="text-sm font-semibold text-neutral-900">{prompt}</p>
      <form action="/search" className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="brand" value="ABM" />
        <input
          name="q"
          required
          placeholder="Gene name, symbol, product name or Cat. No."
          className="h-12 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-orange-500"
        />
        <button type="submit" className="h-12 rounded-xl bg-[#ef6331] px-7 text-sm font-semibold text-white transition hover:bg-[#d95221]">
          Search ABM
        </button>
      </form>
    </section>
  );
}

function CrisprHighlights() {
  const items = [
    "CRISPR KO Cell Lines",
    "Cas9 Expressing Cell Lines",
    "Cas9 Proteins",
    "Cas9 Antibody",
    "CRISPR Knock-in Repair Template",
    "Screen It™ CRISPR Cas9 Cleavage Detection Kit",
  ];
  return (
    <section className="mt-10" aria-labelledby="crispr-highlights">
      <h2 id="crispr-highlights" className="text-2xl font-bold text-[#dc5a2b]">Highlighted Products and Services</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((label, index) => (
          <Link key={label} href={`/search?q=${encodeURIComponent(label)}&brand=ABM`} className="group flex min-w-0 flex-col items-center text-center">
            <span className="grid h-[76px] w-[76px] place-items-center rounded-full border-[3px] border-[#ef6331] text-[#ef6331] transition group-hover:bg-orange-50" aria-hidden>
              <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {index % 3 === 0 ? <><circle cx="24" cy="24" r="7"/><path d="M8 24h9M31 24h9M24 8v9M24 31v9"/><circle cx="10" cy="14" r="2"/><circle cx="38" cy="34" r="2"/></> : null}
                {index % 3 === 1 ? <><path d="M13 13c8 2 14 8 22 22M35 13c-8 2-14 8-22 22"/><path d="M17 18h14M15 24h18M17 30h14"/></> : null}
                {index % 3 === 2 ? <><circle cx="24" cy="12" r="3"/><circle cx="12" cy="28" r="3"/><circle cx="36" cy="28" r="3"/><circle cx="24" cy="38" r="3"/><path d="M22 15l-8 10M26 15l8 10M15 30l7 6M33 30l-7 6"/></> : null}
              </svg>
            </span>
            <span className="mt-3 text-sm font-semibold leading-5 text-[#c2410c] group-hover:underline group-hover:underline-offset-4">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function OfficialContent({ node }: { node?: GeneticOfficialNode }) {
  if (!node) return null;
  return (
    <>
      {node.summary ? <p className="mt-5 max-w-4xl text-[15.5px] leading-7 text-slate-600">{node.summary}</p> : null}

      {node.comparison?.length ? (
        <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[680px] border-collapse bg-white text-left text-sm">
            <thead className="bg-[#ef6331] text-white">
              <tr><th className="px-4 py-3">System</th><th className="px-4 py-3">Key Advantages</th><th className="px-4 py-3">Limitations</th></tr>
            </thead>
            <tbody>
              {node.comparison.map((row) => (
                <tr key={row.system} className="border-t border-neutral-200">
                  <th className="px-4 py-3 font-semibold text-neutral-900">{row.system}</th>
                  <td className="px-4 py-3 text-slate-600">{row.advantages}</td>
                  <td className="px-4 py-3 text-slate-600">{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {node.bullets?.length ? (
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-bold text-[#dc5a2b]">Key Advantages</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
            {node.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="text-[#ef6331]">•</span><span>{bullet}</span></li>)}
          </ul>
        </section>
      ) : null}

      {node.searchPrompt ? <CatalogSearch prompt={node.searchPrompt} /> : null}
      {node.key === "crispr" ? <CrisprHighlights /> : null}
    </>
  );
}

function ChildGrid({ children }: { children: ResolvedNode[] }) {
  const visible = children.filter((child) => child.href);
  if (!visible.length) return null;
  return (
    <section className="mt-10" aria-labelledby="genetic-subcategories">
      <h2 id="genetic-subcategories" className="text-2xl font-bold text-[#dc5a2b]">Products</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((child) => (
          <Link key={child.node.key} href={child.href!} className="group flex min-h-24 items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 transition hover:border-orange-300 hover:bg-orange-50/50">
            <span className="font-semibold leading-6 text-neutral-900 group-hover:text-[#c2410c]">{child.node.label}</span>
            <span className="text-xl text-[#ef6331] transition group-hover:translate-x-1" aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function GeneticMaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }> | { path?: string[] };
  searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string };
}) {
  const resolvedParams = await Promise.resolve(params as any);
  const sp = await Promise.resolve(searchParams as any);
  const rest = (resolvedParams?.path || []) as string[];
  const fullPath = [ROOT, ...rest];
  const pathStr = fullPath.join("/");
  const q = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);

  const docs = await sanityCdnClient.fetch<CategoryDoc[]>(QUERY, {}, PUBLIC_CATALOG_CACHE);
  const categories = Array.isArray(docs) ? docs : [];
  if (!categories.length) notFound();

  const tree = resolveTree(ABM_GENETIC_OFFICIAL_TREE, categories);
  const flat = flattenResolved(tree);
  const currentDoc = categories.find((doc) => doc.path.join("/").toLowerCase() === pathStr.toLowerCase());

  if (!currentDoc && rest.length) {
    const requestedLeaf = rest.at(-1) || "";
    const canonical = flat.find((item) => item.href && geneticNodeMatches(item.node, requestedLeaf));
    if (canonical?.href) redirect(canonical.href);
    redirect("/products/abm/genetic-materials");
  }

  const currentResolved = currentDoc
    ? flat.find((item) => item.doc?.path.join("/") === currentDoc.path.join("/"))
      || flat.find((item) => geneticNodeMatches(item.node, currentDoc.title, currentDoc.path.at(-1)))
    : undefined;

  const currentNode = rest.length ? currentResolved?.node : undefined;
  const title = rest.length ? currentNode?.label || currentDoc?.title || "Genetic Materials" : "Genetic Materials";
  const childNodes = rest.length ? currentResolved?.children || [] : tree;

  const shouldLoadProducts = rest.length > 0 && childNodes.filter((child) => child.href).length === 0;
  const allProducts = shouldLoadProducts ? await getAbmStagedRecords("product") : [];
  const products = shouldLoadProducts
    ? allProducts.filter((record) =>
        abmRecordBelongsToProductPath(record, fullPath, currentNode?.label || currentDoc?.title || title)
        || abmRecordBelongsToProductPath(record, fullPath, currentDoc?.title || title),
      )
    : [];

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "ABM", href: "/products/abm" },
    { label: "Genetic Materials", href: "/products/abm/genetic-materials" },
    ...(rest.length ? [{ label: title }] : []),
  ];

  return (
    <div data-abm-genetic-canonical="true">
      <AbmHeroBanner title="ABM Genetic Materials" eyebrow="ABM · ITS BIO" />
      <div className={PAGE_SHELL}>
        <div className="mt-4"><Breadcrumb items={crumbs} /></div>
        <div className={`mt-5 pb-16 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24">
            <OfficialSideNav tree={tree} activePath={fullPath} />
          </aside>
          <main className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef6331]">Genetic Materials</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 md:text-4xl">{title}</h1>

            {!rest.length ? (
              <p className="mt-5 max-w-4xl text-[15.5px] leading-7 text-slate-600">
                Browse ABM's current Genetic Materials structure: Expression-Ready Libraries, CRISPR, Expression Systems, Specialized Vectors and Kits for Viral Vectors. Each category below maps to the existing ITS BIO catalog path rather than a generated slug.
              </p>
            ) : <OfficialContent node={currentNode} />}

            <ChildGrid children={childNodes} />

            {shouldLoadProducts ? (
              products.length ? (
                <AbmStagedCatalog kind="product" records={products} query={q} page={page} basePath={hrefForPath(fullPath)} />
              ) : (
                <section className="mt-10 rounded-xl border border-orange-200 bg-orange-50/40 p-6">
                  <h2 className="text-lg font-bold text-[#dc5a2b]">Catalog search</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">This category is searchable in the unified ABM catalog. Use the search below to find products by name or catalog number.</p>
                  <CatalogSearch prompt={`Search ${title}`} />
                </section>
              )
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
