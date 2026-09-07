const pageUrl = "https://www.abmgood.com/Stable-Cell-Lines.html";
const endpoint = "https://www.abmgood.com/product/searchProducts";
const userAgent = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableCollector/1.0)";

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

console.log(`TOKEN=${token ? "present" : "missing"} COOKIE=${cookies ? "present" : "missing"}`);
if (!token) throw new Error("Unable to read ABM CSRF token");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": userAgent,
    "x-csrf-token": token,
    "x-requested-with": "XMLHttpRequest",
    origin: "https://www.abmgood.com",
    referer: pageUrl,
    cookie: cookies,
  },
  body: JSON.stringify({ _token: token, query: "", filter_id: "63", page: 1 }),
});
console.log(`STATUS=${response.status}`);
const text = await response.text();
console.log(`BODY_PREFIX=${text.slice(0, 1200)}`);
if (!response.ok) process.exit(1);
const payload = JSON.parse(text);
console.log("DATA_META=" + JSON.stringify({
  code: payload?.code,
  dataKeys: Object.keys(payload?.data || {}),
  page: payload?.data?.page,
  lastPage: payload?.data?.lastPage,
  total: payload?.data?.total,
  perPage: payload?.data?.perPage,
  productCount: payload?.data?.products?.length,
  productKeys: Object.keys(payload?.data?.products?.[0] || {}),
  first: payload?.data?.products?.[0] || null,
}));
