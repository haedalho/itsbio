import Link from "next/link";

// Concise guidance reviewed against ABM's category pages on 2026-10-07.
// Keep this separate from the existing product tables, resources and galleries.
const FAQS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  "virus-packaging-dna-mixes": [
    ["What do packaging mixes supply?", "Helper plasmids provide the viral proteins needed to assemble particles in producer cells."],
    ["Which producer cells are commonly used?", "HEK293T cells are commonly used for recombinant viral packaging."],
    ["How do lentivirus and AAV differ?", "Lentivirus integrates its cargo; AAV generally maintains it outside the host genome."],
    ["Can lentivirus deliver genes to non-dividing cells?", "Yes. Retroviral delivery is more restricted to dividing cells."],
    ["What are the approximate cargo limits?", "Lentivirus and retrovirus carry about 8 kb; AAV carries about 4.7 kb."],
    ["Why separate the viral genes?", "Splitting essential functions across plasmids reduces the likelihood of producing replication-competent virus."],
    ["What affects the final yield?", "DNA quality, transfection, plasmid ratios, producer-cell condition and harvest timing all matter."],
    ["How does AAV packaging work?", "AAV uses rep and cap genes together with helper functions."],
  ],
  "virus-transduction-enhancer": [
    ["Which enhancer is intended for lentivirus?", "ViralEntry™ G515 supports lentiviral and retroviral transduction."],
    ["Which enhancer is intended for AAV?", "AAViralEntry™ G516 supports AAV transduction across serotypes."],
    ["How does an enhancer help?", "It improves contact between viral particles and target cells."],
    ["Can it help with difficult cell types?", "ABM reports results in several cell types, including primary T cells and macrophages."],
    ["How is the reagent applied?", "It is added to the culture medium alongside the viral particles; follow the product protocol."],
    ["Is a tenfold improvement guaranteed in every experiment?", "ABM reports improvements of up to tenfold; the result depends on the experimental conditions."],
  ],
  "qpcr-virus-titer-kits": [
    ["Which kit measures lentivirus?", "LV900 uses RT-qPCR for HIV-1-based lentiviral samples."],
    ["Which kit measures AAV?", "G931 measures AAV genome copies using CMV and ITR detection."],
    ["Which kit measures retrovirus?", "G949 uses RT-qPCR for retroviral samples."],
    ["Is a separate purification step required?", "ABM's category workflow does not require sample purification before the assay."],
    ["How quickly are results available?", "ABM describes a one-hour assay workflow."],
  ],
};

const TITER_KITS = [
  { sku: "LV900", system: "HIV-1-based lentivirus", method: "RT-qPCR", input: "Supernatant or concentrated virus" },
  { sku: "G931", system: "AAV", method: "qPCR · CMV / ITR", input: "Purified virus or supernatant" },
  { sku: "G949", system: "Retrovirus", method: "RT-qPCR", input: "Supernatant or purified sample" },
] as const;

const BASE = "genetic-materials/kits-for-viral-vectors/";

export default function AbmViralKitGuide({
  path,
  position,
  sourceHtml,
}: {
  path: string;
  position: "before" | "after";
  sourceHtml: string;
}) {
  if (!path.startsWith(BASE)) return null;
  const slug = path.slice(BASE.length);
  if (!FAQS[slug]) return null;

  if (position === "before") {
    if (slug !== "qpcr-virus-titer-kits" || /Choose Your qPCR Virus Titer Kit/i.test(sourceHtml)) return null;
    return (
      <section className="mt-8" aria-labelledby="abm-titer-selection">
        <h2 id="abm-titer-selection" className="text-2xl font-bold text-orange-600">Select a kit by viral system</h2>
        <p className="mt-3 leading-7 text-neutral-700">Compare the assay and sample type before selecting your 100-reaction kit.</p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200" role="region" aria-label="Virus titer kit comparison" tabIndex={0}>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">ABM viral titer kits: catalog number, viral system, assay and sample type</caption>
            <thead className="bg-[#ef6331] text-white">
              <tr>{["Cat. No.", "Viral system", "Assay", "Sample"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody>
              {TITER_KITS.map((kit) => (
                <tr key={kit.sku} className="border-t border-neutral-200 even:bg-neutral-50">
                  <th scope="row" className="px-4 py-4 font-semibold">
                    <Link href={`/products/abm/staged/product/${kit.sku}?from=${encodeURIComponent(`/products/abm/${path}`)}`} prefetch={false} className="text-orange-700 underline underline-offset-4">{kit.sku}</Link>
                  </th>
                  <td className="px-4 py-4">{kit.system}</td>
                  <td className="px-4 py-4">{kit.method}</td>
                  <td className="px-4 py-4">{kit.input}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // A future CMS refresh may carry the supplier FAQ itself; render it once.
  if (/Frequently Asked Questions|Virus Titer Kit FAQs/i.test(sourceHtml)) return null;
  return (
    <section className="mt-10" aria-labelledby="abm-viral-kit-faq">
      <h2 id="abm-viral-kit-faq" className="text-2xl font-bold text-orange-600">Frequently asked questions</h2>
      <div className="mt-5 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {FAQS[slug].map(([question, answer]) => (
          <details key={question} className="group px-5 py-4">
            <summary className="cursor-pointer font-semibold leading-6 text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600">{question}</summary>
            <p className="mt-3 leading-7 text-neutral-700">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
