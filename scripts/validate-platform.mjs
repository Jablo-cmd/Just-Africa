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

const hardening = read("supabase/migrations/202611160001_hardening.sql");
assert.match(hardening, /guard_published_listing_edits/, "Published listing edits must return to review");
assert.match(hardening, /guard_business_verification/, "Business verification must be recorded server-side");
assert.match(hardening, /grant insert \(listing_id, business_id, traveller_id/, "Public enquiry inserts must use a column allowlist");

const required = [
  "index.html", "destinations.html", "guides.html", "partners.html", "listings.html",
  "account.html", "dashboard.html", "assets/js/main.js", "assets/js/portal.js",
  "assets/js/listings.js", "supabase/seed.sql", "docs/SECURITY_MODEL.md",
  "privacy.html", "terms.html", "404.html", "robots.txt", "sitemap.xml",
  "supabase/migrations/202611160001_hardening.sql"
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
const publicPages = ["index.html", "destinations.html", "guides.html", "listings.html", "partners.html", "privacy.html", "terms.html"];
const privatePages = ["account.html", "dashboard.html", "404.html"];
const pageProblems = [];
for (const file of htmlFiles) {
  const html = read(file);
  if (!/<link rel="icon"/.test(html)) pageProblems.push(`${file}: missing favicon link`);
  if (!/<meta name="description"/.test(html)) pageProblems.push(`${file}: missing meta description`);
  if (publicPages.includes(file) && !/<link rel="canonical"/.test(html)) pageProblems.push(`${file}: missing canonical link`);
  if (privatePages.includes(file) && !/<meta name="robots" content="noindex/.test(html)) pageProblems.push(`${file}: should be noindex`);
  if (publicPages.includes(file) && /noindex/.test(html)) pageProblems.push(`${file}: public page must not be noindex`);
  if (!["privacy.html", "terms.html", "404.html"].includes(file) && !/href="privacy\.html"/.test(html)) pageProblems.push(`${file}: missing privacy link`);
}
assert.deepEqual(pageProblems, [], "Page hygiene problems");
const sitemap = read("sitemap.xml");
for (const file of publicPages) assert.ok(sitemap.includes(baseUrl + (file === "index.html" ? "" : file) + "</loc>"), `sitemap.xml missing ${file}`);
assert.match(read("robots.txt"), /Sitemap: /, "robots.txt must reference the sitemap");
console.log(`Platform checks passed: ${createdTables.length} RLS-protected tables, required pages/files, local links, page hygiene and public-only frontend config.`);
