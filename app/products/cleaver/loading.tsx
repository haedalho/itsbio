import CleaverHeroBanner from "@/components/products/CleaverHeroBanner";

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="aspect-[1.12] animate-pulse bg-slate-100" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-purple-100" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function CleaverLoading() {
  return (
    <main className="bg-white pb-20">
      <CleaverHeroBanner />
      <div className="mx-auto max-w-[1320px] px-6">
        <div className="h-[69px]" />
        <div className="grid gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <div className="h-14 animate-pulse bg-purple-50" />
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          </aside>
          <section>
            <div className="border-b border-slate-200 pb-6">
              <div className="h-3 w-32 animate-pulse rounded bg-purple-100" />
              <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-5 h-11 max-w-xl animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mt-8 flex items-center justify-between">
              <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
