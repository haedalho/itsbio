const pageUrl = "https://www.abmgood.com/Stable-Cell-Lines.html";
const endpoint = "https://www.abmgood.com/product/searchProducts";
const userAgent = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableCollector/1.0)";

async function session() {
  const pageResponse = await fetch(pageUrl, {
    redirect: "follow",
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
  });
  if (!pageResponse.ok) throw new Error(`Stable page HTTP ${pageResponse.status}`);
  const html = await pageResponse.text();
  const token = html.match(/<meta[^>]+name=["']X-CSRF-TOKEN["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']X-CSRF-TOKEN["']/i)?.[1]
    || "";
  const cookies = typeof pageResponse.headers.getSetCookie === "function"
    ? pageResponse.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ")
    : String(pageResponse.headers.get("set-cookie") || "").split(/,(?=[^;]+?=)/).map((value) => value.trim().split(";", 1)[0]).filter(Boolean).join("; ");
  if (!token) throw new Error("Unable to read ABM CSRF token");
  return { token, cookies };
}

async function fetchPage(auth, page) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": userAgent,
      "x-csrf-token": auth.token,
      "x-requested-with": "XMLHttpRequest",
      origin: "https://www.abmgood.com",
      referer: pageUrl,
      cookie: auth.cookies,
    },
    body: JSON.stringify({ _token: auth.token, query: "", filter_id: "63", page }),
  });
  if (!response.ok) throw new Error(`page ${page}: HTTP ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const products = payload?.data?.products || [];
  return {
    page,
    total: payload?.data?.total,
    lastPage: payload?.data?.lastPage,
    perPage: payload?.data?.perPage,
    count: products.length,
    categories: [...new Set(products.map((p) => `${p.category_name}|${p.frontend_category_id}|${p.product_type}|${p.cell_type}`))],
    skus: products.map((p) => p.cat_no),
    samples: products.slice(0, 2).map((p) => ({ sku: p.cat_no, name: p.name, category: p.category_name, frontendCategoryId: p.frontend_category_id, productType: p.product_type, cellType: p.cell_type, filterId: p.filter_id })),
  };
}

const auth = await session();
console.log(`TOKEN=${auth.token ? "present" : "missing"} COOKIE=${auth.cookies ? "present" : "missing"}`);
for (const page of [1, 50, 100, 108, 109, 110, 111, 112, 113, 120, 200, 500, 1000]) {
  try {
    console.log("PAGE_META=" + JSON.stringify(await fetchPage(auth, page)));
  } catch (error) {
    console.log("PAGE_ERROR=" + JSON.stringify({ page, error: String(error?.message || error) }));
  }
  await new Promise((resolve) => setTimeout(resolve, 350));
}
