const urls = [
  "https://www.abmgood.com/search",
  "https://www.abmgood.com/Stable-Cell-Lines.html",
];

for (const url of urls) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-StableProbe/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  console.log(`URL=${url} STATUS=${response.status}`);
  const html = await response.text();
  const lower = html.toLowerCase();
  const needles = ["stable cell lines", "stable-cell-lines", "searchapi", "filter_id", "filter-id", "category_id", "category-id"];
  for (const needle of needles) {
    let index = 0;
    let hits = 0;
    while ((index = lower.indexOf(needle, index)) >= 0 && hits < 8) {
      const start = Math.max(0, index - 700);
      const end = Math.min(html.length, index + needle.length + 900);
      console.log(`--- ${needle} hit ${hits + 1} @${index} ---`);
      console.log(html.slice(start, end).replace(/\s+/g, " "));
      index += needle.length;
      hits += 1;
    }
  }
}
