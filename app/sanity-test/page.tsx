// app/sanity-test/page.tsx
import Link from "next/link";
import { sanityClient } from "@/lib/sanity/sanity.client";

const Q = `
*[_type == "notice"] 
| order(publishedAt desc, _createdAt desc) [0...50]{
  _id,
  title,
  "slug": slug.current,
  summary,
  publishedAt,
  isActive,
  order,
  body
}
`;

export default async function SanityTestPage() {
  const items = await sanityClient.fetch(Q);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Sanity Debug: Notice (top 50)</h1>
      <p className="mt-2 text-sm text-neutral-600">
        여기서 CMS에 들어있는 노티 데이터를 그대로 확인합니다.
      </p>

      <div className="mt-6 space-y-4">
        {(items as any[]).map((it, idx) => (
          <div key={it._id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-500">#{idx + 1}</span>
              <span className="text-sm font-semibold">{it.title ?? "(no title)"}</span>
              {it.isActive === false ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">inactive</span>
              ) : (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">active</span>
              )}
              {typeof it.order === "number" ? (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  order: {it.order}
                </span>
              ) : null}
            </div>

            <div className="mt-2 text-xs text-neutral-600">
              slug: <span className="font-mono">{it.slug ?? "(none)"}</span> ·{" "}
              {it.publishedAt ? new Date(it.publishedAt).toISOString().slice(0, 10) : "(no date)"}
            </div>

            {it.summary ? <div className="mt-2 text-sm text-neutral-700">{it.summary}</div> : null}

            {it.slug ? (
              <div className="mt-3">
                <Link className="text-sm underline" href={`/notice/${it.slug}`}>
                  상세 보기 → /notice/{it.slug}
                </Link>
              </div>
            ) : null}

            {/* body가 들어있는지 확인용 */}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-neutral-600">raw data 보기</summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs">
                {JSON.stringify(it, null, 2)}
              </pre>
            </details>
          </div>
        ))}

        {(items as any[]).length === 0 ? (
          <div className="rounded-xl border border-neutral-200 p-8 text-center text-sm text-neutral-600">
            notice 문서가 0개로 보입니다. (dataset/프로젝트 연결 확인 필요)
          </div>
        ) : null}
      </div>
    </main>
  );
}
