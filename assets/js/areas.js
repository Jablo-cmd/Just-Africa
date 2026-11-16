(() => {
  const { client, escapeHtml, countryName, say } = window.JA;
  const status = document.querySelector("#areas-status");
  const list = document.querySelector("#areas-list");
  const search = document.querySelector("#areas-query");
  const empty = document.querySelector("#areas-empty");
  if (!list) return;
  let areas = [];
  const counts = new Map();

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const visible = areas.filter((a) => !query ||
      [a.name, a.summary, countryName(a.country_code)].some((v) => String(v || "").toLowerCase().includes(query)));
    const groups = new Map();
    visible.forEach((a) => {
      const key = countryName(a.country_code) || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    list.innerHTML = [...groups.keys()].sort().map((country) =>
      '<section class="area-group"><h2>' + escapeHtml(country) + '</h2><div class="area-grid">' +
      groups.get(country).map((a) => {
        const n = counts.get(a.id) || 0;
        return '<a class="area-card" href="area.html?slug=' + encodeURIComponent(a.slug) + '"><span class="country-region">' +
          escapeHtml(a.destination_type) + '</span><h3>' + escapeHtml(a.name) + '</h3><p>' + escapeHtml(a.summary) +
          '</p><span class="area-count">' + (n ? n + (n === 1 ? " hotel" : " hotels") : "Hotels coming soon") + ' →</span></a>';
      }).join("") + '</div></section>').join("");
    empty.hidden = visible.length > 0;
  };

  if (!client) return say(status, "Areas are not available right now. Please try again later.", "error");
  (async () => {
    const { data, error } = await client.from("destinations")
      .select("id,slug,name,destination_type,country_code,summary")
      .eq("is_published", true).in("destination_type", ["area", "city", "park", "island"]).order("name");
    if (error) return say(status, "Areas could not be loaded.", "error");
    areas = data || [];
    const { data: hotels } = await client.from("listings").select("destination_id")
      .eq("status", "published").eq("listing_type", "accommodation").limit(1000);
    (hotels || []).forEach((h) => counts.set(h.destination_id, (counts.get(h.destination_id) || 0) + 1));
    say(status, areas.length ? "Choose an area to see places to stay." : "No areas have been published yet.");
    render();
  })().catch(() => say(status, "Areas could not be loaded.", "error"));
  search.addEventListener("input", render);
})();
