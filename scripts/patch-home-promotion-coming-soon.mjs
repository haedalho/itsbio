import fs from "node:fs/promises";

const file = "app/page.tsx";
let source = await fs.readFile(file, "utf8");

const fallbackStart = source.indexOf("const FALLBACK_PROMOTIONS: PromotionItem[] = [");
const partnersStart = source.indexOf("const PARTNERS = [", fallbackStart);
if (fallbackStart < 0 || partnersStart < 0) throw new Error("Could not find fallback promotions block");
source = source.slice(0, fallbackStart) + source.slice(partnersStart);

source = source.replace(
`  const items = [...fromSanity, ...FALLBACK_PROMOTIONS]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.key === item.key) === index)
    .slice(0, 3);
`,
`  const items = fromSanity.slice(0, 3);
`,
);

source = source.replace(
`            <ArrowLink href="/promotions">View all</ArrowLink>
`,
`            {featured ? (
              <ArrowLink href="/promotions">View all</ArrowLink>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Coming soon
              </span>
            )}
`,
);

source = source.replace(
`          {featured ? (
            <Link href={featured.href} className="group mt-7 block">
              <div className="relative aspect-[2.28/1] overflow-hidden border border-slate-200 bg-white">
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                />
              </div>
              <div className="flex items-start justify-between gap-5 border-b border-slate-200 py-5">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-base font-semibold text-slate-950 group-hover:text-orange-700 md:text-lg">
                    {featured.title}
                  </h3>
                  {featured.summary ? (
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{featured.summary}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-lg text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
              </div>
            </Link>
          ) : null}

          <div>
            {secondary.map((promotion) => (
              <Link key={promotion.key} href={promotion.href} className="group flex items-center gap-5 border-b border-slate-200 py-4">
                <span className="relative h-16 w-28 shrink-0 overflow-hidden border border-slate-100 bg-white sm:h-20 sm:w-36">
                  <img src={promotion.image} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-6 text-slate-800 group-hover:text-orange-700 md:text-base">
                  {promotion.title}
                </span>
                <span className="shrink-0 text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
              </Link>
            ))}
          </div>
`,
`          {featured ? (
            <>
              <Link href={featured.href} className="group mt-7 block">
                <div className="relative aspect-[2.28/1] overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
                <div className="flex items-start justify-between gap-5 border-b border-slate-200 py-5">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-base font-semibold text-slate-950 group-hover:text-orange-700 md:text-lg">
                      {featured.title}
                    </h3>
                    {featured.summary ? (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">{featured.summary}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-lg text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
                </div>
              </Link>

              <div>
                {secondary.map((promotion) => (
                  <Link key={promotion.key} href={promotion.href} className="group flex items-center gap-5 border-b border-slate-200 py-4">
                    <span className="relative h-16 w-28 shrink-0 overflow-hidden border border-slate-100 bg-white sm:h-20 sm:w-36">
                      <img src={promotion.image} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-6 text-slate-800 group-hover:text-orange-700 md:text-base">
                      {promotion.title}
                    </span>
                    <span className="shrink-0 text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="relative mt-7 min-h-[330px] overflow-hidden border border-slate-200 bg-white px-7 py-8 sm:px-10 sm:py-10">
              <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-orange-100" />
              <div className="pointer-events-none absolute -bottom-24 right-12 h-56 w-56 rounded-full border border-slate-100" />
              <div className="pointer-events-none absolute right-20 top-16 h-2.5 w-2.5 rounded-full bg-orange-100" />
              <div className="relative flex h-full min-h-[260px] flex-col justify-center">
                <span className="w-fit border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Promotion · Coming Soon
                </span>
                <h3 className="mt-6 max-w-md text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-3xl">
                  새로운 프로모션을 준비하고 있습니다.
                </h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
                  연구와 실험에 실질적인 도움이 되는 혜택과 새로운 소식을 선별해 곧 안내드리겠습니다.
                </p>
                <div className="mt-7 flex items-center gap-3 text-sm font-medium text-slate-500">
                  <span className="h-px w-8 bg-orange-400" />
                  더 좋은 혜택으로 찾아뵙겠습니다.
                </div>
              </div>
            </div>
          )}
`,
);

if (source.includes("FALLBACK_PROMOTIONS")) throw new Error("Fallback promotion content still remains");
if (!source.includes("새로운 프로모션을 준비하고 있습니다.")) throw new Error("Coming-soon block was not inserted");
await fs.writeFile(file, source);
console.log("Homepage promotion empty state patched.");
