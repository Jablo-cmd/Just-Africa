(() => {
  const { client, escapeHtml, countryName, money, say, UUID, todayISO, nightsBetween } = window.JA;
  const status = document.querySelector("#hotel-status");
  const detail = document.querySelector("#hotel-detail");
  const panel = document.querySelector("#booking-panel");
  const form = document.querySelector("#booking-form");
  if (!detail) return;
  const id = new URLSearchParams(window.location.search).get("id") || "";
  if (!UUID.test(id)) return say(status, "That hotel could not be found.", "error");
  if (!client) return say(status, "Booking is not available right now. Please try again later.", "error");

  const roomSelect = form.elements.room_type_id;
  const availability = document.querySelector("#availability");
  const submit = document.querySelector("#booking-submit");
  let rooms = [], session = null, free = null;

  const selectedRoom = () => rooms.find((r) => r.id === roomSelect.value);
  const refreshQuote = async () => {
    const room = selectedRoom();
    const checkIn = form.elements.check_in.value, checkOut = form.elements.check_out.value;
    const count = Number(form.elements.rooms.value || 1);
    free = null;
    if (!room || !checkIn || !checkOut) { availability.textContent = "Choose your dates to see availability."; return; }
    const nights = nightsBetween(checkIn, checkOut);
    if (!(nights >= 1 && nights <= 60)) { availability.textContent = "Check-out must be 1 to 60 nights after check-in."; return; }
    const total = money(nights * Number(room.price_per_night) * count, room.price_currency);
    const { data, error } = await client.rpc("room_free_units", { p_room_type_id: room.id, p_check_in: checkIn, p_check_out: checkOut });
    if (error) { availability.textContent = "Availability could not be checked."; return; }
    free = data;
    availability.textContent = free >= count
      ? nights + (nights === 1 ? " night" : " nights") + " · estimated total " + total + " · " + free + " available. The property confirms the final price."
      : "Not enough rooms available for those dates" + (free > 0 ? " (" + free + " left)." : ".");
  };

  const render = (h) => {
    const b = h.businesses || {};
    detail.innerHTML = '<p class="country-region">' + escapeHtml([h.destinations?.name, countryName(b.country_code)].filter(Boolean).join(" · ")) +
      '</p><h1>' + escapeHtml(h.title) + '</h1><p class="public-listing-business">' + escapeHtml(b.name || "") + (b.city ? " · " + escapeHtml(b.city) : "") + '</p><p>' +
      escapeHtml(h.description || h.summary || "") + '</p>' +
      ((h.features || []).length ? '<ul class="feature-list">' + h.features.map((f) => "<li>" + escapeHtml(f) + "</li>").join("") + "</ul>" : "") +
      (h.cancellation_summary ? '<p><strong>Cancellation:</strong> ' + escapeHtml(h.cancellation_summary) + "</p>" : "") +
      (h.accessibility_info ? '<p><strong>Accessibility:</strong> ' + escapeHtml(h.accessibility_info) + "</p>" : "");
    rooms = (h.room_types || []).filter((r) => r.is_active);
    document.title = h.title + " — Just Africa";
    if (!rooms.length) { panel.hidden = true; return say(status, "This property has not published rooms for booking yet. You can ask the property a question from the stays page.", ""); }
    roomSelect.innerHTML = rooms.map((r) => '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name + " — " + money(r.price_per_night, r.price_currency) + " per night (sleeps " + r.max_guests + ")") + "</option>").join("");
    panel.hidden = false;
    say(status, "");
  };

  (async () => {
    const { data: s } = await client.auth.getSession();
    session = s.session;
    const today = todayISO();
    form.elements.check_in.min = today; form.elements.check_out.min = today;
    if (session) {
      form.elements.guest_email.value = session.user.email || "";
      form.elements.guest_name.value = session.user.user_metadata?.display_name || "";
    } else {
      document.querySelector("#signin-note").hidden = false;
      document.querySelector("#signin-link").href = "account.html?next=hotel-" + encodeURIComponent(id);
      submit.firstChild.textContent = "Sign in to request ";
    }
    const { data: hotel, error } = await client.from("listings")
      .select("id,title,summary,description,features,cancellation_summary,accessibility_info,businesses(name,city,country_code),destinations(name),room_types(id,name,description,max_guests,units_total,price_per_night,price_currency,is_active)")
      .eq("id", id).eq("listing_type", "accommodation").maybeSingle();
    if (error || !hotel) return say(status, "That hotel could not be found.", "error");
    render(hotel);
  })().catch(() => say(status, "This hotel could not be loaded.", "error"));

  ["room_type_id", "check_in", "check_out", "rooms"].forEach((name) => form.elements[name].addEventListener("change", refreshQuote));
  form.elements.check_in.addEventListener("change", () => {
    const next = form.elements.check_in.value;
    if (next) form.elements.check_out.min = next;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!session) return window.location.assign("account.html?next=hotel-" + encodeURIComponent(id));
    if (!form.checkValidity()) return form.reportValidity();
    const result = document.querySelector("#booking-result");
    submit.disabled = true;
    try {
      const data = new FormData(form);
      const { error } = await client.rpc("request_booking", {
        p_room_type_id: String(data.get("room_type_id")),
        p_check_in: String(data.get("check_in")),
        p_check_out: String(data.get("check_out")),
        p_guests: Number(data.get("guests")),
        p_rooms: Number(data.get("rooms")),
        p_guest_name: String(data.get("guest_name")).trim(),
        p_guest_email: String(data.get("guest_email")).trim(),
        p_notes: String(data.get("notes") || "").trim() || null
      });
      if (error) throw error;
      say(result, "Request sent. The property will confirm or decline it; you can follow it under My bookings in your dashboard. No payment has been taken.", "success");
      form.reset();
      availability.textContent = "";
    } catch (error) {
      say(result, error.message || "We could not send your request. Please try again.", "error");
    } finally {
      submit.disabled = false;
    }
  });
})();
