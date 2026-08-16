export default function SearchLoading() {
  return (
    <main
      className="flex min-h-[calc(100vh-76px)] items-center justify-center bg-slate-50 px-6 py-20"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
          <span
            className="h-8 w-8 animate-spin rounded-full border-[3px] border-orange-200 border-t-orange-600"
            aria-hidden="true"
          />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Searching the catalog…</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Looking for the best match to your search.
        </p>
        <div className="mx-auto mt-7 h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-500" />
        </div>
      </div>
    </main>
  );
}
