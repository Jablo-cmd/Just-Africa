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
assert.match(config, /url:\s*""/, "Committed Supabase URL config must remain empty");
assert.match(config, /publishableKey:\s*""/, "Committed publishable key config must remain empty");

const required = [
  "index.html", "destinations.html", "guides.html", "partners.html", "listings.html",
  "account.html", "dashboard.html", "assets/js/main.js", "assets/js/portal.js",
  "assets/js/listings.js", "supabase/seed.sql", "docs/SECURITY_MODEL.md"
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
console.log(`Platform checks passed: ${createdTables.length} RLS-protected tables, required pages/files, local links and safe empty frontend config.`);
