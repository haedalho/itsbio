import { sanityClient } from "@/lib/sanity.client";
import { BRANDS_QUERY } from "@/lib/sanity.queries";

type Brand = {
  _id: string;
  title: string;
  slug: string;
};

export default async function SanityTestPage() {
  const brands = await sanityClient.fetch<Brand[]>(BRANDS_QUERY);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Sanity 연동 테스트</h1>
      <p className="mt-2 text-sm text-gray-600">
        아래에 ABM, Kent가 보이면 연동 성공.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-medium">Brands</h2>

        {brands.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            브랜드가 0개로 나왔어. Studio에서 Brand 문서가 Publish 되었는지 확인해줘.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {brands.map((b) => (
              <li key={b._id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="font-medium">{b.title}</span>
                <span className="text-sm text-gray-500">/{b.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
