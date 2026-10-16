(() => {
  const config = window.JUST_AFRICA_SUPABASE || {};
  const message = (id, text, kind = "") => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.className = "portal-message" + (kind ? " " + kind : "");
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const slugify = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "listing";
  const clientReady = () => Boolean(config.url && config.publishableKey && window.supabase?.createClient);
  let client = null;
  if (clientReady()) client = window.supabase.createClient(config.url, config.publishableKey);

  const authForm = document.querySelector("#auth-form");
  if (authForm) {
    const recoveryMode = new URLSearchParams(window.location.search).get("recovery") === "1";
    let mode = "signin";
    const modeButtons = [...document.querySelectorAll("[data-auth-mode]")];
    const nameField = document.querySelector("#name-field");
    const heading = document.querySelector("#auth-heading");
    const submit = document.querySelector("#auth-submit");
    const password = authForm.elements.password;
    const syncMode = (next) => {
      mode = next;
      modeButtons.forEach((button) => {
        const active = button.dataset.authMode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      nameField.hidden = mode !== "signup";
      heading.textContent = mode === "signup" ? "Let's get started." : "Come on in.";
      submit.innerHTML = mode === "signup" ? "Create account <span>→</span>" : "Sign in <span>→</span>";
      password.autocomplete = mode === "signup" ? "new-password" : "current-password";
      document.querySelector("#forgot-password").hidden = mode === "signup";
      message("auth-message", "");
    };
    modeButtons.forEach((button) => button.addEventListener("click", () => syncMode(button.dataset.authMode)));
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!client) return message("auth-message", "Account access is not connected yet. A site administrator must configure the Just Africa Supabase project first.", "error");
      const data = new FormData(authForm);
      const email = String(data.get("email") || "").trim();
      const secret = String(data.get("password") || "");
      if (recoveryMode) {
        submit.disabled = true;
        try {
          const { error } = await client.auth.updateUser({ password: secret });
          if (error) throw error;
          window.location.href = "account.html?updated=1";
        } catch (error) {
          message("auth-message", error.message || "The password could not be updated. Request a fresh recovery link.", "error");
        } finally {
          submit.disabled = false;
        }
        return;
      }
      submit.disabled = true;
      message("auth-message", mode === "signup" ? "Creating your account…" : "Signing you in…");
      try {
        if (mode === "signup") {
          const { data: result, error } = await client.auth.signUp({
            email, password: secret,
            options: {
              data: { display_name: String(data.get("display_name") || "").trim() },
              emailRedirectTo: new URL("dashboard.html", window.location.href).href
            }
          });
          if (error) throw error;
          if (!result.session) {
            message("auth-message", "Account created. Check your email to verify the address, then sign in.", "success");
          } else {
            window.location.href = "dashboard.html";
          }
        } else {
          const { error } = await client.auth.signInWithPassword({ email, password: secret });
          if (error) throw error;
          window.location.href = "dashboard.html";
        }
      } catch (error) {
        message("auth-message", error.message || "We could not complete that request. Please try again.", "error");
      } finally {
        submit.disabled = false;
      }
    });
    document.querySelector("#forgot-password").addEventListener("click", async () => {
      if (!client) return message("auth-message", "Password recovery becomes available after the Supabase project is configured.", "error");
      const email = String(authForm.elements.email.value || "").trim();
      if (!email) return message("auth-message", "Enter your email address first.", "error");
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("account.html?recovery=1", window.location.href).href
        });
        if (error) throw error;
        message("auth-message", "If an account exists for that address, a password recovery email has been requested.", "success");
      } catch (error) {
        message("auth-message", error.message || "Password recovery could not be requested.", "error");
      }
    });
    if (!clientReady()) message("auth-message", "Backend setup required: configure the project URL and publishable key after applying the database migration.", "error");
    syncMode("signin");
    if (recoveryMode) {
      modeButtons.forEach((button) => { button.hidden = true; });
      nameField.hidden = true;
      authForm.elements.email.closest("label").hidden = true;
      heading.textContent = "Choose a new password.";
      submit.innerHTML = "Update password <span>→</span>";
      password.autocomplete = "new-password";
      document.querySelector("#forgot-password").hidden = true;
    }
    if (new URLSearchParams(window.location.search).get("updated") === "1") {
      message("auth-message", "Your password has been updated. You can now sign in.", "success");
    }
  }

  const dashboard = document.querySelector("#dashboard-content");
  if (!dashboard) return;
  const signOut = document.querySelector("#sign-out");
  const show = (id, visible = true) => { const node = document.getElementById(id); if (node) node.hidden = !visible; };
  const card = (title, status, body, actions = "") =>
    '<article class="dashboard-item"><div class="dashboard-item-main"><span class="status-pill">' + escapeHtml(status.replaceAll("_", " ")) +
    '</span><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(body || "") + '</p></div>' + (actions ? '<div class="dashboard-item-actions">' + actions + '</div>' : "") + '</article>';
  const actionButton = (action, id, label, variant = "") =>
    '<button type="button" class="small-action ' + variant + '" data-action="' + escapeHtml(action) + '" data-id="' + escapeHtml(id) + '">' + escapeHtml(label) + '</button>';
  const run = async () => {
    if (!client) return message("dashboard-message", "Backend setup required. Configure the Supabase URL and publishable key and apply the migration before using the dashboard.", "error");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) return message("dashboard-message", sessionError.message, "error");
    if (!sessionData.session) {
      window.location.href = "account.html?next=dashboard";
      return;
    }
    const user = sessionData.session.user;
    const { data: profile, error: profileError } = await client.from("profiles").select("display_name,role").eq("id", user.id).single();
    if (profileError) return message("dashboard-message", "We couldn't load your profile. Check that the Just Africa migration is applied and profile policies are active.", "error");
    show("dashboard-content", true);
    document.querySelector("#profile-name").textContent = profile.display_name || user.email || "Traveller";
    document.querySelector("#profile-role").textContent = profile.role.replaceAll("_", " ");
    document.querySelector("#dashboard-title").textContent = "Welcome back.";
    message("dashboard-message", "");
    if (profile.role === "admin" || profile.role === "editor") {
      show("admin-section", true);
      await loadAdmin(profile.role);
    }
    if (profile.role === "business_owner" || profile.role === "admin") {
      show("business-section", true);
      show("traveller-section", false);
      await loadBusinesses(user.id, profile.role);
    } else {
      show("traveller-section", true);
      await loadFavourites(user.id);
    }
  };

  async function loadFavourites(userId) {
    const target = document.querySelector("#favourites-list");
    const { data, error } = await client.from("favourites").select("listing_id, listings(id,title,summary,slug,status)").eq("user_id", userId);
    if (error) return target.innerHTML = '<p class="account-muted">Saved places could not be loaded yet.</p>';
    target.innerHTML = data.length ? data.map((row) => row.listings ? card(row.listings.title, row.listings.status, row.listings.summary, '<a class="small-action" href="destinations.html">Explore more</a>') : "").join("") : '<p class="account-muted">You have no saved listings yet. Explore destinations and check back as more listings become available.</p>';
  }

  async function loadBusinesses(userId, role) {
    const { data, error } = await client.from("businesses").select("id,owner_id,name,status,business_type,description,country_code,city").order("created_at", { ascending: false });
    const target = document.querySelector("#business-list");
    if (error) {
      target.innerHTML = '<p class="account-muted">Business records could not be loaded. Check your access policies.</p>';
      return;
    }
    const ownBusinesses = role === "admin" ? data : data.filter((business) => business.owner_id === userId);
    target.innerHTML = ownBusinesses.length ? ownBusinesses.map((business) => {
      const canAddListing = ["verified", "pending_review"].includes(business.status);
      const action = canAddListing ? actionButton("new-listing", business.id, "Create listing") : "";
      return card(business.name, business.status, [business.city, business.country_code, business.business_type.replaceAll("_", " "), business.description].filter(Boolean).join(" · "), action);
    }).join("") : '<div class="empty-panel"><h3>Your tourism business belongs here.</h3><p>Add your accommodation, tour company, safari operation or guide service. New profiles are reviewed before appearing publicly.</p><button class="small-action" data-action="show-business-form">Add your first business</button></div>';
    await loadInquiries(ownBusinesses.map((business) => business.id));
  }

  async function loadInquiries(ids) {
    const target = document.querySelector("#inquiry-list");
    if (!ids.length) return target.innerHTML = '<p class="account-muted">Add a business first; its enquiries will appear here.</p>';
    const { data, error } = await client.from("inquiries").select("id,traveller_name,traveller_email,message,status,travel_start,travel_end,party_size").in("business_id", ids).order("created_at", { ascending: false }).limit(100);
    if (error) return target.innerHTML = '<p class="account-muted">Enquiries could not be loaded.</p>';
    target.innerHTML = data.length ? data.map((item) => card(item.traveller_name, item.status, item.message + " · " + item.traveller_email + (item.travel_start ? " · From " + item.travel_start : ""), actionButton("close-inquiry", item.id, "Close enquiry"))).join("") : '<p class="account-muted">No enquiries yet.</p>';
  }

  async function loadAdmin(role) {
    const businesses = document.querySelector("#admin-business-list");
    const listings = document.querySelector("#admin-listing-list");
    if (role !== "admin") {
      businesses.innerHTML = '<p class="account-muted">Editor accounts can manage editorial content; business approvals require an admin account.</p>';
      listings.innerHTML = "";
      return;
    }
    const [businessResult, listingResult] = await Promise.all([
      client.from("businesses").select("id,name,status,country_code,city,business_type").eq("status", "pending_review").order("created_at", { ascending: true }).limit(100),
      client.from("listings").select("id,title,status,listing_type,summary,businesses(name,status)").eq("status", "pending_review").order("created_at", { ascending: true }).limit(100)
    ]);
    businesses.innerHTML = businessResult.error ? '<p class="account-muted">Business review queue unavailable.</p>' :
      businessResult.data.length ? businessResult.data.map((b) => card(b.name, b.status, [b.city,b.country_code,b.business_type.replaceAll("_"," ")].filter(Boolean).join(" · "), actionButton("verify-business", b.id, "Verify business", "action-positive") + actionButton("reject-business", b.id, "Reject"))).join("") : '<p class="account-muted">No businesses are waiting for review.</p>';
    listings.innerHTML = listingResult.error ? '<p class="account-muted">Listing review queue unavailable.</p>' :
      listingResult.data.length ? listingResult.data.map((l) => card(l.title, l.status, (l.businesses?.name || "Business") + " · " + l.listing_type + " · " + l.summary, actionButton("publish-listing", l.id, "Approve & publish", "action-positive") + actionButton("reject-listing", l.id, "Reject"))).join("") : '<p class="account-muted">No listings are waiting for review.</p>';
  }

  document.querySelector("#become-business-owner")?.addEventListener("click", async () => {
    const button = document.querySelector("#become-business-owner");
    button.disabled = true;
    const { error } = await client.rpc("become_business_owner");
    if (error) { button.disabled = false; return message("dashboard-message", error.message, "error"); }
    window.location.reload();
  });
  document.querySelector("#toggle-business-form")?.addEventListener("click", () => show("business-form", document.querySelector("#business-form").hidden));
  document.querySelector("#business-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const { data: auth } = await client.auth.getUser();
    const name = String(data.get("name")).trim();
    const payload = {
      owner_id: auth.user.id, name, slug: slugify(name) + "-" + crypto.randomUUID().slice(0, 8),
      business_type: data.get("business_type"), country_code: String(data.get("country_code")).trim().toUpperCase(),
      city: String(data.get("city") || "").trim() || null, description: String(data.get("description") || "").trim(),
      email: String(data.get("email") || "").trim() || null, website_url: String(data.get("website_url") || "").trim() || null,
      status: "pending_review"
    };
    const { error } = await client.from("businesses").insert(payload);
    if (error) return message("dashboard-message", error.message, "error");
    form.reset(); show("business-form", false); message("dashboard-message", "Business submitted. It must be reviewed before appearing publicly.", "success");
    const { data: profile } = await client.from("profiles").select("role").eq("id", auth.user.id).single();
    await loadBusinesses(auth.user.id, profile?.role || "business_owner");
  });

  document.querySelector("#listing-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const title = String(data.get("title")).trim();
    const price = String(data.get("price_from") || "").trim();
    const payload = {
      business_id: data.get("business_id"), title,
      slug: slugify(title) + "-" + crypto.randomUUID().slice(0, 8),
      listing_type: data.get("listing_type"), description: String(data.get("description")).trim(),
      summary: String(data.get("description")).trim().slice(0, 220),
      price_from: price ? Number(price) : null,
      price_currency: price ? String(data.get("price_currency") || "USD").trim().toUpperCase() : null,
      status: "pending_review"
    };
    const { error } = await client.from("listings").insert(payload);
    if (error) return message("dashboard-message", error.message, "error");
    form.reset(); show("listing-composer", false); message("dashboard-message", "Listing submitted for review. It will not be public until approved.", "success");
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || !client) return;
    const action = button.dataset.action, id = button.dataset.id;
    if (action === "show-business-form") return show("business-form", true);
    if (action === "new-listing") {
      document.querySelector('#listing-form [name="business_id"]').value = id;
      show("listing-composer", true);
      document.querySelector("#listing-composer").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    button.disabled = true;
    try {
      let result;
      if (action === "verify-business") result = await client.from("businesses").update({status:"verified",verified_at:new Date().toISOString()}).eq("id",id);
      else if (action === "reject-business") result = await client.from("businesses").update({status:"rejected"}).eq("id",id);
      else if (action === "publish-listing") result = await client.from("listings").update({status:"published",published_at:new Date().toISOString()}).eq("id",id);
      else if (action === "reject-listing") result = await client.from("listings").update({status:"rejected"}).eq("id",id);
      else if (action === "close-inquiry") result = await client.from("inquiries").update({status:"closed"}).eq("id",id);
      if (result?.error) throw result.error;
      message("dashboard-message", "Update saved.", "success");
      const { data: auth } = await client.auth.getUser();
      const { data: profile } = await client.from("profiles").select("role").eq("id",auth.user.id).single();
      if (profile.role === "admin" || profile.role === "editor") await loadAdmin(profile.role);
      if (profile.role === "admin" || profile.role === "business_owner") await loadBusinesses(auth.user.id,profile.role);
    } catch (error) {
      message("dashboard-message", error.message || "That update could not be saved.", "error");
      button.disabled = false;
    }
  });

  signOut?.addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    window.location.href = "index.html";
  });
  run().catch((error) => message("dashboard-message", error.message || "Dashboard could not be loaded.", "error"));
})();