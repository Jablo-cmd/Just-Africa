(() => {
  const { client, escapeHtml, countryName, money, say, SLUG } = window.JA;
  const title = document.querySelector("#area-title");
  const intro = document.querySelector("#area-intro");
  const status = document.querySelector("#area-status");
  const grid = document.querySelector("#hotel-grid");
  const empty = document.querySelector("#hotel-empty");
  if (!grid) return;
  const slug = new URLSearchParams(window.location.search).get("slug") || "";
  if (!SLUG.test(slug)) return say(status, "That area could not be found. Choose one from the list of areas.", "error");
  if (!client) return say(status, "Hotels are not available right now. Please try again later.", "error");

  const fromPrice = (rooms) => {
    const best = new Map();
    (rooms || []).filter((r) => r.is_active).forEach((r) => {
      const price = Number(r.price_per_night);
      if (!best.has(r.price_currency) || price < best.get(r.price_currency)) best.set(r.price_currency, price);
    });
    const parts = [...best.entries()].map(([cur, price]) => money(price, cur));
    return parts.length ? "From " + parts.join(" / ") + " per night" : "Ask for rates";
  };

  (async () => {
    const { data: area, error } = await client.from("destinations")
      .select("id,slug,name,country_code,summary,destination_type").eq("slug", slug).eq("is_published", true).maybeSingle();
    if (error || !area) return say(status, "That area could not be found. Choose one from the list of areas.", "error");
    document.title = "Hotels in " + area.name + " — Just Africa";
    title.textContent = "Stay in " + area.name;
    intro.textContent = area.summary + " " + countryName(area.country_code) + ".";
    const { data: hotels, error: hotelError } = await client.from("listings")
      .select("id,title,summary,description,businesses(name,city),room_types(price_per_night,price_currency,is_active)")
      .eq("status", "published").eq("listing_type", "accommodation").eq("destination_id", area.id).order("published_at", { ascending: false });
    if (hotelError) return say(status, "Hotels could not be loaded.", "error");
    say(status, hotels.length ? hotels.length + (hotels.length === 1 ? " hotel" : " hotels") + " in " + area.name + "." : "");
    empty.hidden = hotels.length > 0;
    grid.innerHTML = hotels.map((h) =>
      '<article class="public-listing-card"><div class="public-listing-image"><span class="verified-label">✓ Verified business</span></div><div class="public-listing-body"><p class="country-region">' +
      escapeHtml(h.businesses?.city || area.name) + '</p><h2>' + escapeHtml(h.title) + '</h2><p class="public-listing-business">' +
      escapeHtml(h.businesses?.name || "") + '</p><p class="public-listing-description">' + escapeHtml(h.summary || h.description || "") +
      '</p><div class="public-listing-foot"><strong>' + escapeHtml(fromPrice(h.room_types)) + '</strong><a class="small-action action-positive" href="hotel.html?id=' +
      encodeURIComponent(h.id) + '">View &amp; book <span aria-hidden="true">→</span></a></div></div></article>').join("");
  })().catch(() => say(status, "Hotels could not be loaded.", "error"));
})();
