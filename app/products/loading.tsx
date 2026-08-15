export default function ProductsLoading() {
  return (
    <main className="bg-slate-50/70" aria-busy="true" aria-live="polite">
      <div className="mx-auto min-h-[58vh] max-w-[1320px] px-6 py-10">
        <div className="animate-pulse">
          <div className="ml-auto h-4 w-64 rounded-full bg-slate-200" />
          <div className="mt-10 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
            <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="h-4 rounded bg-slate-100" style={{ width: `${76 + (index % 3) * 8}%` }} />
                ))}
              </div>
            </aside>

            <section className="min-w-0">
              <div className="h-4 w-28 rounded-full bg-orange-100" />
              <div className="mt-4 h-9 w-80 max-w-full rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full max-w-2xl rounded bg-slate-100" />
              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="h-40 bg-slate-100" />
                    <div className="space-y-3 p-5">
                      <div className="h-5 w-4/5 rounded bg-slate-200" />
                      <div className="h-4 w-2/5 rounded bg-slate-100" />
                      <div className="h-4 w-full rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        <p className="sr-only">Loading products…</p>
      </div>
    </main>
  );
}
