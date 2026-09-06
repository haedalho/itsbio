export default function CleaverCatalogLoading() {
  return (
    <main className="bg-white pb-20">
      <div className="h-[210px] animate-pulse bg-[#f4edf8]" />
      <div className="mx-auto max-w-[1320px] px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          <section>
            <div className="h-4 w-28 animate-pulse rounded bg-purple-100" />
            <div className="mt-3 h-9 w-64 animate-pulse rounded bg-slate-100" />
            <div className="mt-6 h-11 max-w-xl animate-pulse rounded-full bg-slate-100" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="aspect-[1.12] animate-pulse bg-slate-50" />
                  <div className="p-4">
                    <div className="h-3 w-20 animate-pulse rounded bg-purple-100" />
                    <div className="mt-3 h-5 w-full animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
