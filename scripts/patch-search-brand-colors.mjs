#!/usr/bin/env node
import fs from "node:fs";

const file = "app/search/page.tsx";
let source = fs.readFileSync(file, "utf8");

const tones = `

type BrandTone = { accent: string; deep: string; soft: string };

const BRAND_TONES: Record<string, BrandTone> = {
  abm: { accent: "#ef6331", deep: "#c94f24", soft: "#fff7ed" },
  kent: { accent: "#0040a8", deep: "#003783", soft: "#eff6ff" },
  cleaverscientific: { accent: "#9333ea", deep: "#581c87", soft: "#faf5ff" },
  seedburo: { accent: "#16a34a", deep: "#14532d", soft: "#f0fdf4" },
  aims: { accent: "#0284c7", deep: "#0c4a6e", soft: "#f0f9ff" },
  bioplastics: { accent: "#f59e0b", deep: "#92400e", soft: "#fffbeb" },
  cellfreesciences: { accent: "#1d4ed8", deep: "#172554", soft: "#eff6ff" },
  itschem: { accent: "#e11d48", deep: "#881337", soft: "#fff1f2" },
  plaslabs: { accent: "#475569", deep: "#0f172a", soft: "#f8fafc" },
  affinityimmuno: { accent: "#06b6d4", deep: "#164e63", soft: "#ecfeff" },
  dogen: { accent: "#b91c1c", deep: "#450a0a", soft: "#fef2f2" },
  other: { accent: "#f2632f", deep: "#c2410c", soft: "#fff7ed" },
};

function brandTone(key: string) {
  return BRAND_TONES[key] || BRAND_TONES.other;
}
`;

if (!source.includes("const BRAND_TONES:")) {
  const marker = "};\n\nfunction normalizeCatalogNumber";
  if (!source.includes(marker)) throw new Error("BRAND_ALIASES marker not found");
  source = source.replace(marker, `};${tones}\nfunction normalizeCatalogNumber`);
}

const cardStart = source.indexOf("function ResultCard({ result }: { result: SearchResult }) {");
const cardEnd = source.indexOf("\nfunction Pagination(", cardStart);
if (cardStart < 0 || cardEnd < 0) throw new Error("ResultCard block not found");

const newCard = `function ResultCard({ result }: { result: SearchResult }) {
  const tone = brandTone(result.brandKey);

  return (
    <article
      className="group border-b border-slate-200 bg-white transition last:border-b-0 hover:bg-slate-50/80"
      style={{ borderLeft: \`3px solid \${tone.accent}\` }}
    >
      <div className="flex items-start gap-4 px-5 py-5 md:px-6 md:py-6">
        <div
          className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xs font-bold tracking-wide sm:flex"
          style={{ borderColor: \`\${tone.accent}35\`, backgroundColor: tone.soft, color: tone.deep }}
        >
          {result.brandLabel.slice(0, 3).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-semibold">
            <span style={{ color: tone.deep }}>{result.brandLabel}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{result.kind}</span>
            {result.sku ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-600">Cat. No. {result.sku}</span>
              </>
            ) : null}
          </div>

          <Link href={result.href} className="mt-2 block text-lg font-semibold leading-7 text-slate-950 transition group-hover:underline group-hover:underline-offset-4">
            {result.title}
          </Link>

          {result.description ? (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600">{result.description}</p>
          ) : null}
        </div>

        <Link
          href={result.href}
          aria-label={\`\${result.direct ? "View" : "Browse"} \${result.title}\`}
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition group-hover:translate-x-0.5"
          style={{ borderColor: \`\${tone.accent}45\`, backgroundColor: tone.soft, color: tone.deep }}
        >
          →
        </Link>
      </div>
    </article>
  );
}
`;

source = source.slice(0, cardStart) + newCard + source.slice(cardEnd);

source = source.replace(
  '<span className="truncate pr-2">{group.label}</span>',
  '<span className="flex min-w-0 items-center gap-2 truncate pr-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: brandTone(group.key).accent }} /><span className="truncate">{group.label}</span></span>'
);

source = source.replaceAll(
  '{group.label} <span className="opacity-70">{group.items.length}</span>',
  '<span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandTone(group.key).accent }} />{group.label} <span className="opacity-70">{group.items.length}</span>'
);

if (source.includes("Product details available on the product page.")) {
  throw new Error("Fallback product-details copy still present after patch");
}

fs.writeFileSync(file, source);
console.log("Search brand colors patched successfully.");
