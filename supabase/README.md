# Just Africa backend setup

The site currently ships as static HTML. This folder establishes the database foundation for turning it into a working platform; it does **not** mean a live Supabase project has been connected or deployed.

## Provisioning

1. Create a dedicated Supabase project for Just Africa. Do not reuse a production project from another product.
2. Open the SQL Editor and apply `migrations/202610160001_just_africa_core.sql` to that new project, or adopt it into a local Supabase CLI workflow before deploying.
3. Review the SQL and run Supabase Database Linter/advisors before accepting real users.
4. Configure Auth providers, email verification, redirect URLs, SMTP, abuse protection and password policies in the dashboard.
5. Create a private Storage bucket for business/listing uploads and add narrowly scoped policies. Do not make uploads public by default.
6. Set the frontend's project URL and publishable key using the configuration described in `.env.example`. Never expose a secret/service-role key in browser code.
7. Promote the first admin only through a trusted, authenticated database/admin procedure. Do not allow public sign-up metadata to set privileged roles.
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

## Important launch gaps

The schema is the first backend milestone, not the complete product. Frontend auth, owner dashboards, moderation workflows, enquiry delivery/email, signed image uploads, billing, affiliate partner integrations, analytics consent, rate limiting, and operational monitoring still need implementation and testing. No real booking or payment is enabled by this migration.

## Safety notes

- All public-schema tables have row-level security enabled.
- Only published destinations/articles and verified-business published listings are intended for public discovery.
- User-supplied profile metadata is not used for authorization.
- Do not store card details. Use a compliant payment provider and server-side webhook verification if/when billing is added.
- Add retention and deletion policies for personal enquiry data before launch.
