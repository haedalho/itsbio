const PUBLICATIONS = [
  {
    title: "Matrix mechanics and water permeation regulate extracellular vesicle transport.",
    citation: "Lenzini S. et al. · Nature Nanotechnology (2020)",
    doi: "10.1038/s41565-020-0636-2",
  },
  {
    title: "AXL-initiated paracrine activation of pSTAT3 enhances mesenchymal and vasculogenic supportive features of tumor-associated macrophages.",
    citation: "Hung C. et al. · Cell Reports (2023)",
    doi: "10.1016/j.celrep.2023.113067",
  },
  {
    title: "RBFOX2 deregulation promotes pancreatic cancer progression and metastasis through alternative splicing.",
    citation: "Maurin M. et al. · Nature Communications (2023)",
    doi: "10.1038/s41467-023-44126-w",
  },
] as const;

export function AbmPackagingVideo() {
  return (
    <section className="mt-10" aria-labelledby="packaging-video-heading">
      <h2 id="packaging-video-heading" className="text-2xl font-semibold text-[#ef6331]">Videos</h2>
      <div className="mt-5 aspect-video w-full max-w-[800px] overflow-hidden rounded-xl border border-neutral-200">
        <iframe
          className="h-full w-full"
          src="https://www.youtube.com/embed/LzgsgVO5WYI"
          title="ABM virus packaging video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </section>
  );
}

export function AbmPackagingPublications() {
  return (
    <section className="mt-10" aria-labelledby="packaging-publications-heading">
      <h2 id="packaging-publications-heading" className="text-2xl font-semibold text-[#ef6331]">Top Publications</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {PUBLICATIONS.map((publication, index) => (
          <article key={publication.doi} className="min-w-0 border-t border-neutral-200 pt-4">
            <span className="text-xl font-bold text-[#ef6331]">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-sm font-semibold leading-6 text-neutral-900">{publication.title}</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{publication.citation}</p>
            <a className="mt-3 inline-block break-all text-sm font-semibold text-orange-700 underline underline-offset-4" href={`https://doi.org/${publication.doi}`} target="_blank" rel="noopener noreferrer">doi: {publication.doi}</a>
          </article>
        ))}
      </div>
    </section>
  );
}
