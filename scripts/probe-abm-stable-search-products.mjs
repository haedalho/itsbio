const endpoint = "https://www.abmgood.com/product/searchProducts";
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-StableCollector/1.0)",
  },
  body: JSON.stringify({ _token: "", query: "", filter_id: "63", page: 1 }),
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
