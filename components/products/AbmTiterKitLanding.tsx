import Link from "next/link";

export const TITER_PATH = "genetic-materials/kits-for-viral-vectors/qpcr-virus-titer-kits";
const FROM = `/products/abm/${TITER_PATH}`;
const CDN = "https://cdn.sanity.io/images/9b5twpc8/production/";
const kitHref = (sku: string) => `/products/abm/staged/product/${sku}?from=${encodeURIComponent(FROM)}`;

// Product facts checked against the three ABM product pages on 2026-10-07.
export const TITER_KITS = [
  { sku: "LV900", name: "qPCR Lentivirus Titer Kit", system: "Lentivirus", vector: "HIV-1-based lentivirus", method: "RT-qPCR", input: "Supernatant or concentrated virus", description: "A single-step RT-qPCR assay for quantifying HIV-1-based lentiviral stocks." },
  { sku: "G931", name: "qPCR AAV Titer Kit", system: "AAV", vector: "AAV", method: "qPCR", input: "Purified AAV or supernatant", description: "Measures AAV genome copies with CMV and ITR primer options." },
  { sku: "G949", name: "qPCR Retrovirus Titer Kit", system: "Retrovirus", vector: "Retrovirus", method: "RT-qPCR", input: "Supernatant or purified sample", description: "A single-step RT-qPCR assay for quantifying retroviral stocks." },
] as const;

const DATA = [
  { title: "Results in Only 1 Hour", label: "Workflow Time", asset: "2be628976c636a33df833ca32b5d5e4280e4076e-311x215.png", width: 311, height: 215, text: "LV900 reaction time compared with a Taqman® RNA-to-Ct™ one-step kit and a conventional two-step reaction." },
  { title: "Accurate AAV Titers", label: "AAV Titering", asset: "8e31a70f81691c4358a4b85f2e0247e73e854610-652x221.png", width: 652, height: 221, text: "G931 measurements for AAV3, AAV5 and AAV7 using CMV and ITR primers." },
  { title: "Easy Visualization", label: "qPCR Output", asset: "419c0db72b838b4d088ad1e37f5f6fc86755933f-2101x1010.jpg", width: 2101, height: 1010, text: "LV900 amplification curves compare the viral sample with the standards supplied in the kit." },
] as const;

const PUBLICATIONS = [
  { sku: "LV900", title: "Vascular heterogeneity of tight junction Claudins guides organotropic metastasis", journal: "Nature Cancer, 2024", doi: "10.1038/s43018-024-00813-1" },
  { sku: "G931", title: "Muscle cell-derived Ccl8 is a negative regulator of skeletal muscle regeneration", journal: "The FASEB Journal, 2024", doi: "10.1096/fj.202400184R" },
  { sku: "G949", title: "SLC45A4 encodes a peroxisomal putrescine transporter that promotes GABA de novo synthesis", journal: "Nature Communications, 2025", doi: "10.1038/s41467-025-62721-x" },
] as const;

const REVIEWS = [
  { name: "Kelly Taylor", institution: "Medical University of South Carolina", text: "Reported straightforward, rapid and accurate testing, with useful online calculator support." },
  { name: "Ying Liu", institution: "University of Texas Health Science Center Houston", text: "Reported convenient use and a short titration workflow." },
  { name: "Xinping Huang", institution: "Emory University", text: "Reported repeated use for viruses lacking reporter genes." },
] as const;

const FAQS = [
  ["Which qPCR Virus Titer Kit should I use for lentivirus?", "Select LV900 for HIV-1-based lentivirus. It uses RT-qPCR and accepts supernatant or concentrated virus."],
  ["Which kit is designed for AAV titering?", "Select G931 for AAV genome-copy measurements with CMV and ITR detection."],
  ["Which kit should I use for retrovirus titration?", "Select G949 for retroviral stocks using RT-qPCR."],
  ["Do the qPCR Virus Titer Kits require sample purification?", "A separate purification step is not required for the category workflow."],
  ["How quickly can the kits provide viral titer results?", "ABM specifies a one-hour reaction workflow."],
  ["What are the main benefits of qPCR-based viral titering?", "Measured viral input supports stock QC, lot comparisons, MOI calculations and transduction planning."],
] as const;

const RESOURCES = [
  { title: "Introduction to PCR", url: "https://info.abmgood.com/polymerase-chain-reaction-pcr-introduction", asset: "af026953763ced52bba6dbf33ae00f7a1480ae34-365x183.png" },
  { title: "Reverse Transcription", url: "https://info.abmgood.com/polymerase-chain-reaction-pcr-reverse-transcription", asset: "262377573f329d6aa15b0321eb468750ed7e2715-365x183.png" },
] as const;

const heading = "text-2xl font-bold leading-snug text-[#ef6331]";
const card = "min-w-0 rounded-xl border border-neutral-200 bg-white p-5";
const text = "mt-3 leading-7 text-neutral-700";
const link = "font-semibold text-orange-700 underline underline-offset-4";

export default function AbmTiterKitLanding() {
  return (
    <div data-abm-titer-landing className="space-y-10">
      <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-6 sm:p-8">
        <h2 className="text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">Streamline Viral Titering.<br />Results in Only 1 Hour.</h2>
        <p className={text}>ABM offers ready-to-use qPCR and RT-qPCR kits for lentivirus, AAV and retrovirus quantification, with simplified sample preparation for viral stock QC.</p>
        <div className="mt-5 flex flex-wrap gap-4"><a href="#titer-kits" className={link}>Compare the 3 Kits</a><Link href="/contact" className={link}>Ask ITS BIO about samples</Link></div>
        <h3 className="mt-6 font-bold">Choose by viral system</h3>
        <div className="mt-3 flex flex-wrap gap-3">{TITER_KITS.map(kit => <Link key={kit.sku} href={kitHref(kit.sku)} prefetch={false} className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-800">{kit.sku} · {kit.system} · {kit.method}</Link>)}</div>
      </section>

      <section aria-labelledby="titer-quick-answer"><h2 id="titer-quick-answer" className={heading}>What are qPCR Virus Titer Kits?</h2><p className={text}>These kits quantify viral vector stocks by qPCR or RT-qPCR for QC, MOI planning and downstream experiments.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">{[
          ["What it does", "Measure viral titer", "Quantify viral input before comparing lots or setting up experiments."],
          ["Which kit to choose", "Match the viral system", "LV900: lentivirus. G931: AAV. G949: retrovirus."],
          ["Key benefits", "Fast, simple, ready-to-use", "One-hour results, clean NTC controls and no separate purification step."],
        ].map(([label, title, body]) => <article key={label} className={card}><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{label}</p><h3 className="mt-2 font-bold">{title}</h3><p className={text}>{body}</p></article>)}</div>
      </section>

      <section aria-labelledby="titer-workflow"><h2 id="titer-workflow" className={heading}>Simple Workflow from Sample to Titer</h2><ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Add Viral Sample", "No purification step."], ["Set Up Reaction", "Use the supplied reagents."], ["Run qPCR", "One-hour reaction."], ["Calculate Titer", "Use ABM’s titer calculator."],
      ].map(([title, body], i) => <li key={title} className={card}><p className="text-sm font-semibold text-orange-700">Step {i + 1}</p><h3 className="mt-2 font-bold">{title}</h3><p className={text}>{body}</p></li>)}</ol></section>

      <section aria-labelledby="titer-benefits"><p className="text-sm font-semibold text-orange-700">All Kits Featuring</p><h2 id="titer-benefits" className={heading}>Built for Faster Viral Vector Quantification</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["1-Hour Results", "Clean NTC Controls", "No Purification Needed", "Ready-to-use Format"].map(title => <div key={title} className={card}><h3 className="font-bold">{title}</h3></div>)}</div></section>

      <section id="titer-kits" className="scroll-mt-28" aria-labelledby="titer-kits-heading"><h2 id="titer-kits-heading" className={heading}>Choose Your qPCR Virus Titer Kit</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">{TITER_KITS.map(kit => <article key={kit.sku} className={card}><p className="font-bold text-orange-700">{kit.sku}</p><h3 className="mt-2 text-lg font-bold">{kit.name}</h3><p className={text}>{kit.description}</p><dl className="mt-4 space-y-2 text-sm">{[["Vector", kit.vector], ["Method", kit.method], ["Input", kit.input], ["Size", "100 rxn"]].map(([label, value]) => <div key={label} className="grid grid-cols-[65px_1fr] gap-2"><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl><Link href={kitHref(kit.sku)} prefetch={false} className={`mt-5 inline-block ${link}`}>View {kit.system} Kit</Link></article>)}</div>
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200" role="region" aria-label="qPCR Virus Titer Kit comparison" tabIndex={0}><table className="w-full min-w-[650px] border-collapse text-left text-sm"><caption className="sr-only">Compare the three qPCR Virus Titer Kits</caption><thead className="bg-[#ef6331] text-white"><tr>{["Product", "Cat. No.", "Viral System", "Method", "Size"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{TITER_KITS.map(kit => <tr key={kit.sku} className="border-t border-neutral-200 even:bg-neutral-50"><td className="px-4 py-4"><Link href={kitHref(kit.sku)} prefetch={false} className={link}>{kit.name}</Link></td><td className="px-4 py-4"><Link href={kitHref(kit.sku)} prefetch={false} className={link}>{kit.sku}</Link></td><td className="px-4 py-4">{kit.system}</td><td className="px-4 py-4">{kit.method}</td><td className="px-4 py-4">100 rxn</td></tr>)}</tbody></table></div>
      </section>

      <section aria-labelledby="titer-purpose"><h2 id="titer-purpose" className={heading}>Why Viral Titering Matters</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{["Plan MOI with Confidence", "Compare Viral Lots", "Reduce Workflow Delays"].map(title => <article key={title} className={card}><h3 className="font-bold">{title}</h3></article>)}</div></section>

      <section id="titer-data" className="scroll-mt-28" aria-labelledby="titer-data-heading"><h2 id="titer-data-heading" className={heading}>Performance Data at a Glance</h2><div className="mt-5 space-y-6">{DATA.map(data => <figure key={data.title} className={card}><p className="text-sm font-semibold text-orange-700">{data.label}</p><h3 className="mt-2 text-lg font-bold">{data.title}</h3><div className="mt-5 flex justify-center"><img src={CDN + data.asset} alt={data.title} width={data.width} height={data.height} className="h-auto max-w-full object-contain" style={{ width: Math.min(data.width, 760) }} loading="lazy" /></div><figcaption className={text}>{data.text}</figcaption></figure>)}</div></section>

      <section id="titer-publications" className="scroll-mt-28" aria-labelledby="titer-publications-heading"><h2 id="titer-publications-heading" className={heading}>Publications &amp; Customer Reviews</h2><h3 className="mt-5 text-lg font-bold">Featured Publications</h3><div className="mt-4 grid gap-4 md:grid-cols-3">{PUBLICATIONS.map(pub => <article key={pub.doi} className={card}><p className="font-bold text-orange-700">{pub.sku}</p><a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block leading-6 ${link}`}>{pub.title}</a><p className="mt-3 text-sm text-neutral-600">{pub.journal}</p></article>)}</div><h3 className="mt-7 text-lg font-bold">Customer Reviews · LV900</h3><div className="mt-4 grid gap-4 md:grid-cols-3">{REVIEWS.map(review => <article key={review.name} className={card}><p className="leading-7 text-neutral-700">{review.text}</p><p className="mt-4 font-bold">{review.name}</p><p className="mt-1 text-sm text-neutral-600">{review.institution}</p></article>)}</div></section>

      <section aria-labelledby="titer-faq-heading"><h2 id="titer-faq-heading" className={heading}>qPCR Virus Titer Kit FAQs</h2><div className="mt-5 divide-y divide-neutral-200 rounded-xl border border-neutral-200">{FAQS.map(([question, answer]) => <details key={question} className="px-5 py-4"><summary className="cursor-pointer font-semibold leading-6 focus-visible:outline-2 focus-visible:outline-orange-600">{question}</summary><p className={text}>{answer}</p></details>)}</div></section>

      <section className="rounded-xl border border-orange-100 bg-orange-50/60 p-6"><h2 className={heading}>Need help choosing a kit?</h2><p className={text}>Contact ITS BIO about your viral system or sample availability.</p><Link href="/contact" className={`mt-4 inline-block ${link}`}>Contact ITS BIO</Link></section>

      <section aria-labelledby="titer-resources-heading"><h2 id="titer-resources-heading" className={heading}>Resources</h2><div className="mt-5 grid max-w-[780px] gap-6 sm:grid-cols-2">{RESOURCES.map(resource => <a key={resource.title} href={resource.url} target="_blank" rel="noopener noreferrer" className={card}><img src={CDN + resource.asset} alt={resource.title} width={365} height={183} className="h-auto w-full object-contain" loading="lazy" /><h3 className="mt-4 font-bold text-orange-700">{resource.title}</h3><p className="mt-2 text-sm italic text-neutral-600">PCR Knowledge Base</p></a>)}</div></section>

      <section className="border-t border-neutral-200 pt-6"><h2 className={heading}>Ready to Streamline Viral Titering?</h2><div className="mt-4 flex flex-wrap gap-5"><a href="#titer-kits" className={link}>Compare Kits</a><a href="#titer-data" className={link}>View Data</a><a href="#titer-publications" className={link}>View Publications &amp; Reviews</a></div></section>
    </div>
  );
}
