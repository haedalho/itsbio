export default function AbmProductDetailLoading() {
  return (
    <main className="min-h-[64vh] bg-white" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1320px] px-6 py-12">
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50/70 px-6 text-center">
          <div className="relative h-14 w-14" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-orange-600 border-r-orange-400" />
            <div className="absolute inset-[18px] rounded-full bg-orange-500" />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Loading product…</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Retrieving product information, images, and technical resources.</p>
        </div>
      </div>
    </main>
  );
}
