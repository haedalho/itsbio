// Concise guidance reviewed against ABM's category pages on 2026-10-07.
// Keep this separate from the existing product tables, resources and galleries.
const FAQS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  "virus-packaging-dna-mixes": [
    ["How does a packaging mix function?", "Helpers supply particle-production proteins; the transfer vector supplies cargo."],
    ["What viral systems can be selected?", "Lentiviral, retroviral and serotype-specific AAV mixes are available."],
    ["What determines the choice of system?", "Match your construct, target cells and expression goal."],
    ["Which helpers accompany a lentiviral transfer vector?", "Packaging and envelope plasmids; third-generation systems separate Rev."],
    ["Why do lentiviral titers vary?", "Construct design, transfection and cell condition matter; ABM commonly observes higher second-generation yields."],
    ["Are third-party transfer vectors compatible?", "Check generation, LTR and promoter requirements before selecting helpers."],
    ["Which producer line is commonly chosen?", "HEK293T is recommended for its transfection performance."],
    ["What distinguishes the three vector systems?", "Lentivirus and retrovirus integrate; AAV usually remains episomal. Retrovirus favors dividing cells."],
    ["Are helper plasmids intended for target-cell integration?", "No. Helper functions are separated from the transferred cargo."],
    ["How are the two lentiviral generations organized?", "Second generation uses three plasmids; third generation uses four, separating Rev."],
    ["Is an additional transfection reagent required?", "Use a compatible reagent to introduce DNA into producer cells; ABM recommends DNAfectin Plus."],
    ["Is one formulation suitable for every cell type?", "Select a mix compatible with your cells and workflow."],
    ["Which inputs influence virus production?", "Producer-cell health, DNA quality and compatible reagents influence yield."],
    ["What should be checked when gene delivery underperforms?", "Review titer, target-cell condition and delivery conditions; consider a compatible enhancer."],
    ["What storage does ABM specify?", "Keep frozen at −20°C in a manual-defrost freezer."],
    ["Must helper components be combined separately?", "No. The supplied mixes already combine the packaging components."],
    ["Which system is commonly used for CRISPR delivery?", "Lentiviral systems are commonly selected for stable integration and pooled screens."],
    ["Can the mixes support stable cell lines?", "Lentiviral and retroviral systems can support stable expression."],
    ["Why might packaging performance change?", "Cell condition, DNA quality, construct size and reagent compatibility affect performance."],
    ["When are individual helper plasmids useful?", "Premixed helpers simplify setup; individual plasmids offer customization."],
  ],
  "virus-transduction-enhancer": [
    ["Which enhancer is intended for lentivirus?", "ViralEntry™ G515 supports lentiviral and retroviral transduction."],
    ["Which enhancer is intended for AAV?", "AAViralEntry™ G516 supports AAV transduction across serotypes."],
    ["How does an enhancer help?", "It improves contact between viral particles and target cells."],
    ["Can it help with difficult cell types?", "ABM reports results in several cell types, including primary T cells and macrophages."],
    ["How is the reagent applied?", "It is added to the culture medium alongside the viral particles; follow the product protocol."],
    ["Is a tenfold improvement guaranteed in every experiment?", "ABM reports improvements of up to tenfold; the result depends on the experimental conditions."],
  ],

};

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

  if (position === "before") return null;

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
