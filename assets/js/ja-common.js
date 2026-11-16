// Small helpers shared by the area, hotel and booking pages.
window.JA = (() => {
  const config = window.JUST_AFRICA_SUPABASE || {};
  const client = config.url && config.publishableKey && window.supabase?.createClient
    ? window.supabase.createClient(config.url, config.publishableKey) : null;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const countryName = (code) => {
    try { return new Intl.DisplayNames(["en"], { type: "region" }).of(String(code || "").toUpperCase()) || code; }
    catch { return code || ""; }
  };
  const money = (amount, currency) => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return (currency || "") + " " + amount; }
  };
  const say = (node, text, kind = "") => {
    if (!node) return;
    node.textContent = text;
    node.className = "portal-message" + (kind ? " " + kind : "");
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nightsBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  return { client, escapeHtml, countryName, money, say, UUID, SLUG, todayISO, nightsBetween };
})();
