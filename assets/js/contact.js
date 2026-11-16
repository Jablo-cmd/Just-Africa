(() => {
  const form = document.querySelector("#contact-form");
  if (!form) return;
  const status = document.querySelector("#contact-status");
  const button = document.querySelector("#contact-submit");
  const config = window.JUST_AFRICA_SUPABASE || {};
  const client = config.url && config.publishableKey && window.supabase?.createClient
    ? window.supabase.createClient(config.url, config.publishableKey) : null;
  const say = (text, kind = "") => {
    status.textContent = text;
    status.className = "portal-message" + (kind ? " " + kind : "");
  };
  const COOLDOWN_MS = 30000;
  const lastSent = () => { try { return Number(sessionStorage.getItem("ja-contact-sent") || 0); } catch { return 0; } };
  const markSent = () => { try { sessionStorage.setItem("ja-contact-sent", String(Date.now())); } catch { /* storage unavailable */ } };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    // Hidden spam-trap field: real visitors never fill it. Pretend success so bots learn nothing.
    if (String(data.get("website") || "").trim()) {
      form.reset();
      return say("Thank you — your message has been sent.", "success");
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!client) return say("Messaging is not available right now. Please try again later.", "error");
    if (Date.now() - lastSent() < COOLDOWN_MS) return say("Please wait a moment before sending another message.", "error");
    button.disabled = true;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const { error } = await client.from("contact_messages").insert({
        name: String(data.get("name")).trim(),
        email: String(data.get("email")).trim(),
        topic: String(data.get("topic") || "general"),
        message: String(data.get("message")).trim(),
        user_id: sessionData.session?.user?.id || null
      });
      if (error) throw error;
      markSent();
      form.reset();
      say("Thank you — your message has been sent. We will reply by email.", "success");
    } catch {
      say("We could not send your message. Please check the details and try again.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();
