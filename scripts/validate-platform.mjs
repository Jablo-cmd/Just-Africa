import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202610160001_just_africa_core.sql");
const createdTables = [...migration.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]);
const rlsTables = [...migration.matchAll(/alter table public\.([a-z_]+) enable row level security/g)].map((match) => match[1]);

assert.equal(createdTables.length, 11, "Expected the 11 core platform tables");
assert.deepEqual([...createdTables].sort(), [...rlsTables].sort(), "Every created public table must enable RLS");
assert.match(migration, /create or replace function public\.become_business_owner\(\)/, "Business owner self-service transition must exist");
assert.match(migration, /guard_listing_publication/, "Listing publication must be admin-controlled");
assert.match(migration, /grant update \(status, business_reply, replied_at\) on public\.inquiries/, "Businesses must not rewrite traveller enquiry messages");

const config = read("assets/js/supabase-config.js");
// The URL and publishable key are public by design and may be committed; secrets must never be.
assert.match(config, /url:\s*"(?:|https:\/\/[a-z0-9]+\.supabase\.co)"/, "Supabase URL must be empty or an https://<ref>.supabase.co URL");
assert.match(config, /publishableKey:\s*"(?:|sb_publishable_[A-Za-z0-9_-]+)"/, "Supabase key must be empty or a sb_publishable_ key");
assert.doesNotMatch(config, /service_role|sb_secret_|eyJ[A-Za-z0-9_-]{10,}/, "Secret/service-role keys must never be committed");

const patch = read("supabase/migrations/202611010001_hardening_patch.sql");
assert.match(patch, /guard_listing_publication/, "Published listing edits must return to review");
assert.match(patch, /guard_business_changes/, "Business ownership/verification fields must be guarded");
const contactMigration = read("supabase/migrations/202611160002_contact_messages.sql");
assert.match(contactMigration, /alter table public\.contact_messages enable row level security/, "contact_messages must enable RLS");
assert.match(contactMigration, /grant insert \(name, email, topic, message, user_id\)/, "Public contact inserts must use a column allowlist");
assert.doesNotMatch(contactMigration, /grant select[^;]*to[^;]*anon/i, "Anonymous users must never read contact messages");
const notifyMigration = read("supabase/migrations/202611160003_contact_notifications.sql");
assert.match(notifyMigration, /revoke all on function public\.notify_contact_message\(\) from public, anon, authenticated/, "Notification trigger function must not be callable by API roles");
assert.match(notifyMigration, /exception when others then/, "Notification enqueue failures must never block a contact submission");
const notifyFunction = read("supabase/functions/notify-contact/index.ts");
assert.match(notifyFunction, /Deno\.env\.get\("NOTIFY_TO"\)/, "Notification recipient must come from a secret, not source code");
assert.match(notifyFunction, /\.is\("notified_at", null\)/, "Function must claim a message once before sending (no duplicate emails)");
const hardening = read("supabase/migrations/202611160001_hardening.sql");
assert.match(hardening, /record_business_verification/, "Business verification actor must be recorded server-side");
assert.match(hardening, /grant insert \(listing_id, business_id, traveller_id/, "Public enquiry inserts must use a column allowlist");
assert.match(hardening, /revoke all on public\.profiles/, "API roles must start from least-privilege table grants");

const required = [
  "index.html", "destinations.html", "guides.html", "partners.html", "listings.html",
  "account.html", "dashboard.html", "assets/js/main.js", "assets/js/portal.js",
  "assets/js/listings.js", "supabase/seed.sql", "docs/SECURITY_MODEL.md",
  "privacy.html", "terms.html", "404.html", "robots.txt", "sitemap.xml",
  "supabase/migrations/202611010001_hardening_patch.sql",
  "supabase/migrations/202611160001_hardening.sql",
  "supabase/migrations/202611160002_contact_messages.sql",
  "contact.html", "assets/js/contact.js",
  "supabase/migrations/202611160003_contact_notifications.sql",
  "supabase/functions/notify-contact/index.ts"
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing required platform file: ${file}`);

const htmlFiles = required.filter((file) => file.endsWith(".html"));
const missingLinks = [];
for (const file of htmlFiles) {
  const html = read(file);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || value.startsWith("#") || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
    const pathname = value.split(/[?#]/)[0];
    if (!pathname) continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), pathname))) missingLinks.push(`${file} -> ${value}`);
  }
}
assert.deepEqual(missingLinks, [], "Found missing local assets or links");

// Page-level SEO/privacy hygiene.
const baseUrl = "https://jablo-cmd.github.io/Just-Africa/";
const publicPages = ["index.html", "destinations.html", "guides.html", "listings.html", "partners.html", "privacy.html", "terms.html", "contact.html"];
const privatePages = ["account.html", "dashboard.html", "404.html"];
const pageProblems = [];
for (const file of htmlFiles) {
  const html = read(file);
  if (!/<link rel="icon"/.test(html)) pageProblems.push(`${file}: missing favicon link`);
  if (!/<meta name="description"/.test(html)) pageProblems.push(`${file}: missing meta description`);
  if (publicPages.includes(file) && !/<link rel="canonical"/.test(html)) pageProblems.push(`${file}: missing canonical link`);
  if (privatePages.includes(file) && !/<meta name="robots" content="noindex/.test(html)) pageProblems.push(`${file}: should be noindex`);
  if (publicPages.includes(file) && /noindex/.test(html)) pageProblems.push(`${file}: public page must not be noindex`);
  if (!["privacy.html", "terms.html", "404.html", "contact.html"].includes(file) && !/href="privacy\.html"/.test(html)) pageProblems.push(`${file}: missing privacy link`);
}
assert.deepEqual(pageProblems, [], "Page hygiene problems");
// Contact details must never be published in page markup; visitors use the contact form.
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const exposed = [];
for (const file of [...htmlFiles, "assets/js/contact.js", "assets/js/portal.js", "assets/js/listings.js", "assets/js/main.js", "supabase/functions/notify-contact/index.ts"]) {
  for (const found of read(file).match(emailPattern) || []) {
    if (!/@example\.com$/i.test(found)) exposed.push(`${file}: ${found}`);
  }
}
assert.deepEqual(exposed, [], "Real email addresses must not appear in site pages (use the contact form)");
const sitemap = read("sitemap.xml");
for (const file of publicPages) assert.ok(sitemap.includes(baseUrl + (file === "index.html" ? "" : file) + "</loc>"), `sitemap.xml missing ${file}`);
assert.match(read("robots.txt"), /Sitemap: /, "robots.txt must reference the sitemap");
console.log(`Platform checks passed: ${createdTables.length} RLS-protected tables, required pages/files, local links, page hygiene and public-only frontend config.`);
