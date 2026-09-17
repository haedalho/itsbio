"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SearchOption = { label: string; filter: string };
type SearchConfig = {
  title: string;
  description: string;
  options: SearchOption[];
};
type SearchResult = {
  sku: string;
  title: string;
  species: string;
  accession: string;
  category: string;
  vector: string;
  promoter: string;
  url: string;
};
type SearchResponse = {
  query: string;
  page: number;
  lastPage: number;
  total: number;
  results: SearchResult[];
  error?: string;
};

const CONFIGS: Record<string, SearchConfig> = {
  "genetic-materials/expression-ready-libraries": {
    title: "Search Expression-Ready Libraries",
    description: "Search by gene symbol, accession number, product name, or catalog number.",
    options: [
      { label: "cDNA Libraries", filter: "2,3,4" },
      { label: "CRISPR sgRNA Libraries", filter: "10,11" },
      { label: "miRNA Libraries", filter: "8" },
      { label: "siRNA Libraries", filter: "7" },
      { label: "ORF Vectors", filter: "6" },
      { label: "circRNA", filter: "31" },
    ],
  },
  "genetic-materials/crispr": {
    title: "Search CRISPR Products",
    description: "Find sgRNA, CRISPR activation, Cas9 vector, and Cas protein products.",
    options: [
      { label: "sgRNA Lentivector", filter: "1" },
      { label: "sgRNA AAV", filter: "2" },
      { label: "sgRNA Non-viral", filter: "3" },
      { label: "sgRNA Cell Line", filter: "4" },
      { label: "CRISPR Activation", filter: "5" },
      { label: "Cas9 Vectors & Virus", filter: "6" },
      { label: "Cas9 Proteins", filter: "7" },
    ],
  },
  "genetic-materials/crispr/crispr-ko-vectors-and-virus": {
    title: "Search CRISPR KO Vectors & Virus",
    description: "Search the official sgRNA catalog by gene or catalog number.",
    options: [
      { label: "Lentiviral sgRNA", filter: "1" },
      { label: "AAV sgRNA", filter: "2" },
      { label: "Non-viral sgRNA", filter: "3" },
    ],
  },
  "genetic-materials/crispr/crispr-activation-vectors": {
    title: "Search CRISPR Activation Vectors",
    description: "Search the official CRISPR activation catalog.",
    options: [{ label: "CRISPR Activation", filter: "5" }],
  },
  "genetic-materials/expression-ready-libraries/lentiviral-vectors-and-virus": {
    title: "Search Lentiviral Libraries",
    description: "Search cDNA, sgRNA, miRNA, or siRNA lentiviral products.",
    options: [
      { label: "cDNA", filter: "2" },
      { label: "CRISPR sgRNA", filter: "10,11" },
      { label: "miRNA", filter: "8" },
      { label: "siRNA", filter: "7" },
    ],
  },
  "genetic-materials/expression-ready-libraries/aav-vectors-and-virus": {
    title: "Search AAV Libraries",
    description: "Search cDNA, sgRNA, siRNA, or circRNA AAV products.",
    options: [
      { label: "cDNA", filter: "3" },
      { label: "CRISPR sgRNA", filter: "10,11" },
      { label: "siRNA", filter: "7" },
      { label: "circRNA", filter: "31" },
    ],
  },
  "genetic-materials/expression-ready-libraries/adenovirus": {
    title: "Search Adenovirus Libraries",
    description: "Search official adenovirus cDNA products.",
    options: [{ label: "Adenovirus cDNA", filter: "4" }],
  },
  "genetic-materials/expression-ready-libraries/orf-vectors": {
    title: "Search ORF Vectors",
    description: "Search by gene, species, accession number, or catalog number.",
    options: [{ label: "ORF Vectors", filter: "6" }],
  },
  "genetic-materials/expression-ready-libraries/circrna": {
    title: "Search circRNA Products",
    description: "Search the official circRNA product catalog.",
    options: [{ label: "circRNA", filter: "31" }],
  },
  "genetic-materials/expression-ready-libraries/mirna": {
    title: "Search miRNA Products",
    description: "Search miRNA expression, inhibitor, and qPCR products.",
    options: [{ label: "miRNA", filter: "8" }],
  },
  "genetic-materials/expression-ready-libraries/sirna": {
    title: "Search siRNA Products",
    description: "Search by gene, species, accession number, or catalog number.",
    options: [{ label: "siRNA", filter: "7" }],
  },
  "genetic-materials/expression-ready-libraries/sirna/lentivirus-sirna-expression-library": {
    title: "Search siRNA Lentivirus",
    description: "Search official siRNA lentiviral products.",
    options: [{ label: "siRNA Lentivirus", filter: "7" }],
  },
  "genetic-materials/expression-ready-libraries/sirna/aav-sirna-expression-library": {
    title: "Search siRNA AAV",
    description: "Search official siRNA AAV products.",
    options: [{ label: "siRNA AAV", filter: "7" }],
  },
  "genetic-materials/expression-ready-libraries/sirna/sirna-oligo-dsrna-library": {
    title: "Search siRNA dsRNA Oligo",
    description: "Search official synthetic siRNA and dsRNA oligo products.",
    options: [{ label: "siRNA dsRNA Oligo", filter: "7" }],
  },
};

function resultHref(result: SearchResult) {
  const params = new URLSearchParams({ title: result.title, sku: result.sku });
  if (result.url) params.set("u", result.url);
  return `/products/abm/resolve?${params.toString()}`;
}

export default function AbmGeneticCatalogSearch({ pathStr }: { pathStr: string }) {
  const config = CONFIGS[pathStr];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(config?.options[0]?.filter || "");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!config) return null;

  async function search(page: number) {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError("검색어를 2자 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: normalized, filter, page: String(page) });
      const result = await fetch(`/api/abm/genetic-search?${params.toString()}`, { cache: "no-store" });
      const payload = await result.json() as SearchResponse;
      if (!result.ok) throw new Error(payload.error || "검색 결과를 불러오지 못했습니다.");
      setResponse(payload);
    } catch (searchError) {
      setResponse(null);
      setError(searchError instanceof Error ? searchError.message : "검색 결과를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(1);
  }

  return (
    <section className="mt-7 rounded-2xl border border-orange-200 bg-orange-50/60 p-5" aria-labelledby="abm-genetic-search-title">
      <h2 id="abm-genetic-search-title" className="text-xl font-bold text-neutral-900">{config.title}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{config.description}</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div>
          <label htmlFor="abm-genetic-query" className="sr-only">Gene, accession number, product name, or catalog number</label>
          <input
            id="abm-genetic-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gene, accession, product name, Cat. No."
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="abm-genetic-filter" className="sr-only">Product family</label>
          <select
            id="abm-genetic-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            {config.options.map((option) => <option key={`${option.filter}-${option.label}`} value={option.filter}>{option.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading} className="h-11 rounded-xl bg-orange-600 px-6 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
      {response ? (
        <div className="mt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700">
            <p><strong className="text-neutral-900">{response.total.toLocaleString()}</strong> results for “{response.query}”</p>
            <p>Page {response.page} of {response.lastPage}</p>
          </div>
          {response.results.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white" role="region" aria-label="Genetic Materials search results" tabIndex={0}>
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[#f26332] text-white">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product Name</th>
                    <th className="px-4 py-3 font-bold">Cat. No.</th>
                    <th className="px-4 py-3 font-bold">Species</th>
                    <th className="px-4 py-3 font-bold">Accession</th>
                    <th className="px-4 py-3 font-bold">Vector / Promoter</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((result) => (
                    <tr key={`${result.sku}-${result.title}`} className="border-t border-neutral-200 align-top hover:bg-orange-50/60">
                      <td className="px-4 py-3 font-semibold text-orange-700"><Link href={resultHref(result)}>{result.title}</Link></td>
                      <td className="px-4 py-3"><Link href={resultHref(result)} className="font-semibold text-orange-700">{result.sku}</Link></td>
                      <td className="px-4 py-3 text-neutral-700">{result.species || "—"}</td>
                      <td className="px-4 py-3 text-neutral-700">{result.accession || "—"}</td>
                      <td className="px-4 py-3 text-neutral-700">{[result.vector, result.promoter].filter(Boolean).join(" / ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-4 rounded-xl bg-white p-4 text-sm text-neutral-700">No matching products were found.</p>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={() => void search(response.page - 1)} disabled={loading || response.page <= 1} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => void search(response.page + 1)} disabled={loading || response.page >= response.lastPage} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
