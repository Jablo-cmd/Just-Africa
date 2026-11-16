// Dashboard: guest bookings, hotel booking requests, room types and the area picker for listings.
(() => {
  const { client, escapeHtml, money, say } = window.JA;
  const content = document.querySelector("#dashboard-content");
  if (!content || !client) return;
  const flash = document.querySelector("#dashboard-message");
  const show = (id, visible) => { const n = document.getElementById(id); if (n) n.hidden = !visible; };
  const item = (title, status, body, actions = "") =>
    '<article class="dashboard-item"><div class="dashboard-item-main"><span class="status-pill">' + escapeHtml(status) + '</span><h3>' +
    escapeHtml(title) + '</h3><p>' + escapeHtml(body) + '</p></div>' + (actions ? '<div class="dashboard-item-actions">' + actions + '</div>' : "") + '</article>';
  const btn = (action, id, label, variant = "") =>
    '<button type="button" class="small-action ' + variant + '" data-book-action="' + escapeHtml(action) + '" data-id="' + escapeHtml(id) + '">' + escapeHtml(label) + '</button>';
  let user = null, role = null, businessIds = [];

  const stay = (b) => b.check_in + " → " + b.check_out + " (" + b.nights + (b.nights === 1 ? " night" : " nights") + ", " +
    b.rooms + (b.rooms === 1 ? " room" : " rooms") + ", " + b.guests + (b.guests === 1 ? " guest" : " guests") + ") · " + money(b.total_amount, b.currency);
  const cols = "id,status,check_in,check_out,nights,guests,rooms,total_amount,currency,notes,guest_name,guest_email,created_at,listings(title),room_types(name)";

  async function loadMine() {
    const target = document.querySelector("#my-bookings-list");
    const { data, error } = await client.from("bookings").select(cols).eq("guest_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) { target.innerHTML = '<p class="account-muted">Your bookings could not be loaded.</p>'; return; }
    target.innerHTML = data.length ? data.map((b) => item(
      (b.listings?.title || "Hotel") + " · " + (b.room_types?.name || "Room"), b.status,
      stay(b) + (b.status === "requested" ? " — waiting for the property to respond. No payment has been taken." : ""),
      ["requested", "confirmed"].includes(b.status) ? btn("cancel", b.id, "Cancel booking") : "")).join("")
      : '<p class="account-muted">No bookings yet. <a href="areas.html">Find a hotel</a> to request your first stay.</p>';
  }

  async function loadHost() {
    const list = document.querySelector("#host-bookings-list");
    let q = client.from("bookings").select(cols).order("created_at", { ascending: false }).limit(100);
    if (role !== "admin") q = businessIds.length ? q.in("business_id", businessIds) : null;
    const { data, error } = q ? await q : { data: [], error: null };
    if (error) list.innerHTML = '<p class="account-muted">Booking requests could not be loaded.</p>';
    else list.innerHTML = data.length ? data.map((b) => item(
      b.guest_name + " · " + (b.listings?.title || "") + " · " + (b.room_types?.name || ""), b.status,
      stay(b) + " · " + b.guest_email + (b.notes ? " · Notes: " + b.notes : ""),
      b.status === "requested" ? btn("confirm", b.id, "Confirm", "action-positive") + btn("decline", b.id, "Decline")
        : b.status === "confirmed" ? btn("cancel", b.id, "Cancel booking") : "")).join("")
      : '<p class="account-muted">No booking requests yet.</p>';

    const roomsList = document.querySelector("#host-rooms-list");
    const select = document.querySelector("#room-form [name=listing_id]");
    let lq = client.from("listings").select("id,title,status,room_types(id,name,max_guests,units_total,price_per_night,price_currency,is_active)").eq("listing_type", "accommodation").order("created_at", { ascending: false });
    if (role !== "admin") lq = businessIds.length ? lq.in("business_id", businessIds) : null;
    const { data: listings, error: lerr } = lq ? await lq : { data: [], error: null };
    if (lerr) { roomsList.innerHTML = '<p class="account-muted">Rooms could not be loaded.</p>'; return; }
    const hasListings = listings.length > 0;
    show("room-form", hasListings); show("room-hint", !hasListings);
    select.innerHTML = listings.map((l) => '<option value="' + escapeHtml(l.id) + '">' + escapeHtml(l.title + " (" + l.status.replaceAll("_", " ") + ")") + "</option>").join("");
    const roomItems = [];
    listings.forEach((l) => (l.room_types || []).forEach((r) => {
      roomItems.push(item(
        l.title + " · " + r.name, r.is_active ? "active" : "hidden",
        money(r.price_per_night, r.price_currency) + " per night · sleeps " + r.max_guests + " · " + r.units_total + (r.units_total === 1 ? " room" : " rooms"),
        btn("toggle-room", r.id + "|" + (r.is_active ? "0" : "1"), r.is_active ? "Hide" : "Show") + btn("delete-room", r.id, "Delete")));
    }));
    roomsList.innerHTML = roomItems.length ? roomItems.join("") : '<p class="account-muted">No rooms yet.</p>';
  }

  async function loadAreaOptions() {
    const select = document.querySelector("#listing-destination");
    if (!select) return;
    const { data } = await client.from("destinations").select("id,name,country_code").eq("is_published", true).order("name");
    select.innerHTML = '<option value="">Choose an area…</option>' + (data || []).map((a) =>
      '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name + " (" + window.JA.countryName(a.country_code) + ")") + "</option>").join("");
  }

  const refresh = async () => { await loadMine(); if (role === "business_owner" || role === "admin") await loadHost(); };

  const init = async () => {
    const { data: s } = await client.auth.getSession();
    if (!s.session) return;
    user = s.session.user;
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role || "traveller";
    show("my-bookings-section", true);
    loadAreaOptions();
    if (role === "business_owner" || role === "admin") {
      const { data: owned } = await client.from("businesses").select("id").eq("owner_id", user.id);
      businessIds = (owned || []).map((b) => b.id);
      show("host-bookings-section", true);
    }
    await refresh();
  };

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-book-action]");
    if (!button) return;
    const action = button.dataset.bookAction, id = button.dataset.id;
    button.disabled = true;
    try {
      let result;
      if (action === "cancel") result = await client.rpc("cancel_booking", { p_booking_id: id });
      else if (action === "confirm") result = await client.rpc("respond_to_booking", { p_booking_id: id, p_decision: "confirmed" });
      else if (action === "decline") result = await client.rpc("respond_to_booking", { p_booking_id: id, p_decision: "declined" });
      else if (action === "toggle-room") { const [roomId, flag] = id.split("|"); result = await client.from("room_types").update({ is_active: flag === "1" }).eq("id", roomId); }
      else if (action === "delete-room") result = await client.from("room_types").delete().eq("id", id);
      if (result?.error) throw result.error;
      say(flash, "Updated.", "success");
      await refresh();
    } catch (error) {
      say(flash, /foreign key|violates/.test(error.message || "") ? "This room has bookings and cannot be deleted. Hide it instead." : (error.message || "That could not be done."), "error");
      button.disabled = false;
    }
  });

  document.querySelector("#room-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const { error } = await client.from("room_types").insert({
      listing_id: String(data.get("listing_id")), name: String(data.get("name")).trim(),
      description: String(data.get("description") || "").trim(),
      max_guests: Number(data.get("max_guests")), units_total: Number(data.get("units_total")),
      price_per_night: Number(data.get("price_per_night")), price_currency: String(data.get("price_currency")).trim().toUpperCase()
    });
    if (error) return say(flash, error.message || "The room could not be added.", "error");
    form.reset(); say(flash, "Room added.", "success"); await loadHost();
  });

  init().catch(() => say(flash, "Bookings could not be loaded.", "error"));
})();
