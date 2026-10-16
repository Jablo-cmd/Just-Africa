# Just Africa backend setup

The site currently ships as static HTML. This folder establishes the database foundation for turning it into a working platform; it does **not** mean a live Supabase project has been connected or deployed.

## Provisioning

1. Create a dedicated Supabase project for Just Africa. Do not reuse a production project from another product.
2. Open the SQL Editor and apply `migrations/202610160001_just_africa_core.sql` to that new project, or adopt it into a local Supabase CLI workflow before deploying.
3. Review the SQL and run Supabase Database Linter/advisors before accepting real users.
4. Configure Auth providers, email verification, redirect URLs, SMTP, abuse protection and password policies in the dashboard.
5. Create a private Storage bucket for business/listing uploads and add narrowly scoped policies. Do not make uploads public by default.
6. For the current static GitHub Pages frontend, set `url` and `publishableKey` in `assets/js/supabase-config.js`. The publishable key is intentionally public. Never expose a secret/service-role key in browser code. `.env.example` is a template for a future Vite build, not read by the current static pages.
7. Promote the first admin only through a trusted SQL Editor session after identifying the correct verified account ID, for example `update public.profiles set role = 'admin' where id = '<verified-auth-user-uuid>';`. Never run this from browser code or accept a role from signup metadata.
8. Verify RLS by testing as anonymous, traveller, business owner, editor and admin before launch.

## Data model

- Profiles and roles
- Hierarchical destinations
- Businesses with review/verification states
- Listings and listing images
- Traveller favourites and private business enquiries
- Editorial articles
- Sponsored placement scheduling
- Affiliate click attribution
- User reports and moderation state

## Current frontend status

The repository now includes scaffold-level account sign-up/sign-in/password recovery, a role-aware dashboard, business registration, listing submission, admin approval controls, and a public listing/enquiry page. These depend on this migration and a configured project. They have passed JavaScript syntax checks only; they have **not** been exercised against a live Supabase instance, and are not production-verified.

## Important launch gaps

Email delivery/notification, private signed image uploads, billing, affiliate partner integrations, analytics consent, rate limiting, moderation audit logs and operational monitoring still need implementation and testing. No real booking or payment is enabled by this migration.

## Safety notes

- All public-schema tables have row-level security enabled.
- Only published destinations/articles and verified-business published listings are intended for public discovery.
- User-supplied profile metadata is not used for authorization.
- Do not store card details. Use a compliant payment provider and server-side webhook verification if/when billing is added.
- Add retention and deletion policies for personal enquiry data before launch.
