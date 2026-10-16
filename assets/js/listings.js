(() => {
  const config = window.JUST_AFRICA_SUPABASE || {};
  const status = document.querySelector("#listing-status");
  const grid = document.querySelector("#public-listing-grid");
  const empty = document.querySelector("#listing-empty");
  const form = document.querySelector("#enquiry-form");
  const enquiryPanel = document.querySelector("#enquiry-panel");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const typeLabels = { accommodation:"Accommodation", safari:"Safari", tour:"Tour", guide:"Local guide", restaurant:"Restaurant", transport:"Transport", experience:"Experience" };
  let client = null, listings = [];
  if (config.url && config.publishableKey && window.supabase?.createClient) {
    client = window.supabase.createClient(config.url, config.publishableKey);
  }
  const say = (text, kind = "") => {
    status.textContent = text;
    status.className = "portal-message" + (kind ? " " + kind : "");
  };
  const render = () => {
    const query = document.querySelector("#listing-query").value.trim().toLowerCase();
    const type = document.querySelector("#listing-type").value;
    const country = document.querySelector("#listing-country").value;
    const visible = listings.filter((item) => {
      const business = item.businesses || {};
      const matchesQuery = !query || [item.title,item.summary,item.description,business.name,business.city,item.destinations?.name].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesQuery && (!type || item.listing_type === type) && (!country || business.country_code === country);
    });
    grid.innerHTML = visible.map((item) => {
      const business = item.businesses || {};
      const place = [business.city,business.country_code].filter(Boolean).join(", ");
      const price = item.price_from === null || item.price_from === undefined ? "Contact for pricing" :
        (item.price_currency || "") + " " + Number(item.price_from).toLocaleString(undefined,{maximumFractionDigits:2}) + (item.price_unit ? " / " + item.price_unit : " from");
      return '<article class="public-listing-card"><div class="public-listing-image"><span class="listing-type-label">' + escapeHtml(typeLabels[item.listing_type] || item.listing_type) + '</span><span class="verified-label">✓ Verified business</span></div><div class="public-listing-body"><p class="country-region">' + escapeHtml(place || item.destinations?.name || "Across Africa") + '</p><h2>' + escapeHtml(item.title) + '</h2><p class="public-listing-business">' + escapeHtml(business.name || "Local tourism business") + '</p><p class="public-listing-description">' + escapeHtml(item.summary || item.description || "Contact this business to learn more.") + '</p><div class="public-listing-foot"><strong>' + escapeHtml(price) + '</strong><button type="button" class="small-action action-positive" data-enquire="' + escapeHtml(item.id) + '">Ask about this <span aria-hidden="true">→</span></button></div></div></article>';
    }).join("");
    empty.hidden = visible.length > 0;
  };
  if (!client) {
    say("The directory is ready, but the Supabase project has not been connected. Once the backend is configured, verified live listings will appear here.", "error");
  } else {
    client.from("listings").select("id,title,summary,description,listing_type,price_from,price_currency,price_unit,business_id,businesses(name,city,country_code),destinations(name)").eq("status","published").order("published_at",{ascending:false})
      .then(({data,error}) => {
        if (error) return say("Listings could not be loaded. Check that the database migration and public read policies are active.", "error");
        listings = data || [];
        say(listings.length ? "Showing " + listings.length + " approved listing" + (listings.length === 1 ? "" : "s") + " from verified tourism businesses." : "No approved listings have been published yet. The directory will populate as businesses are verified.", "");
        render();
      });
  }
  ["listing-query","listing-type","listing-country"].forEach((id) => document.getElementById(id).addEventListener(id === "listing-query" ? "input" : "change", render));
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-enquire]");
    if (!button) return;
    const item = listings.find((listing) => listing.id === button.dataset.enquire);
    if (!item) return;
    form.elements.listing_id.value = item.id;
    form.elements.business_id.value = item.business_id;
    document.querySelector("#enquiry-listing-name").textContent = item.title + " · " + (item.businesses?.name || "Tourism business");
    enquiryPanel.hidden = false;
    enquiryPanel.scrollIntoView({behavior:"smooth",block:"start"});
  });
  document.querySelector("#cancel-enquiry").addEventListener("click", () => { enquiryPanel.hidden = true; form.reset(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return say("Enquiries are not connected yet. Please check back after backend setup.", "error");
    const button = document.querySelector("#send-enquiry");
    const data = new FormData(form);
    const start = String(data.get("travel_start") || "");
    const end = String(data.get("travel_end") || "");
    if (start && end && end < start) return say("The travel end date must be on or after the start date.", "error");
    button.disabled = true;
    try {
      const {data: sessionData} = await client.auth.getSession();
      const user = sessionData.session?.user;
      const payload = {
        listing_id: String(data.get("listing_id")),
        business_id: String(data.get("business_id")),
        traveller_id: user?.id || null,
        traveller_name: String(data.get("traveller_name")).trim(),
        traveller_email: String(data.get("traveller_email")).trim(),
        traveller_country: String(data.get("traveller_country") || "").trim().toUpperCase() || null,
        travel_start: start || null,
        travel_end: end || null,
        party_size: String(data.get("party_size") || "").trim() ? Number(data.get("party_size")) : null,
        message: String(data.get("message")).trim()
      };
      const {error} = await client.from("inquiries").insert(payload);
      if (error) throw error;
      say("Your enquiry has been sent to the business. This is not a booking or reservation.", "success");
      form.reset(); enquiryPanel.hidden = true;
    } catch (error) {
      say(error.message || "We could not send your enquiry. Please try again later.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();