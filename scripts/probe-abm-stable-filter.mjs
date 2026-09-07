const MIRROR = "https://r.jina.ai/http://www.abmgood.com/product/searchApi";

function unwrapJina(body) {
  const marker = "Markdown Content:";
  const index = body.indexOf(marker);
  return index >= 0 ? body.slice(index + marker.length).trim() : body.trim();
}

async function fetchFilter(filterId) {
  const url = `${MIRROR}?filter_id=${filterId}&page=1`;
  const response = await fetch(url, { headers: { accept: "text/plain" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = JSON.parse(unwrapJina(await response.text()));
  if (payload?.code !== 0 || !payload?.data) throw new Error("invalid payload");
  return {
    filterId,
    total: Number(payload.data.total || 0),
    lastPage: Number(payload.data.lastPage || 0),
    perPage: Number(payload.data.perPage || 0),
    samples: (payload.data.products || []).slice(0, 4).map((p) => ({
      sku: p.cat_no,
      name: String(p.name || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      species: p.species,
      tissue: p.tissue,
      cellType: p.cell_type,
    })),
  };
}

const rows = [];
for (let filterId = 9; filterId <= 22; filterId += 1) {
  try {
    const row = await fetchFilter(filterId);
    rows.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    console.log(JSON.stringify({ filterId, error: String(error?.message || error) }));
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

const candidates = rows.filter((row) => row.total >= 900 && row.total <= 1400);
console.log("STABLE_FILTER_CANDIDATES=" + JSON.stringify(candidates));
