# Just Africa

**Discover the continent. Experience the extraordinary.**

Just Africa is being built as an Africa-wide tourism discovery platform connecting travellers with destinations, verified accommodation, safari and tour operators, local guides and useful travel editorial.

## Current build

### Public website
- Responsive editorial homepage and destination directory
- Searchable destination cards and travel-style filters
- Travel guides and partner information pages
- Verified stays and experiences directory with search/type/country filters and traveller enquiry form
- Supabase-backed account access, password recovery, business registration, listing submission and admin review UI (requires backend configuration)
- Accessible mobile navigation, reduced-motion support and page metadata

### Backend foundation (new)
- Supabase/Postgres schema for profiles, destinations, businesses, listings, listing images, favourites, enquiries, articles, sponsorships, affiliate click tracking and reports
- Row-level security policies for public discovery and private owner/traveller data
- Business verification and listing-review states
- Initial destination seed data and schema assertion queries
- Security model and phased product roadmap

**Important:** The backend schema and account/business/admin/listing interfaces are committed but have not been connected to a live Supabase project. The front-end flows are code-complete at scaffold level; they are not usable until the migration is applied, the project is configured, RLS is tested and end-to-end behaviour is verified. Email notifications, file upload policies, billing, affiliate integrations and booking workflows are not live.

## Technology

The public MVP currently uses semantic HTML, CSS and vanilla JavaScript. The backend foundation targets Supabase Auth and PostgreSQL. No service-role key or database credentials belong in the browser or repository.

## Run the public site locally

Open `index.html` in a browser, or serve the repository root with any static HTTP server.

## Backend setup

Read:
- [Supabase setup](supabase/README.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Platform roadmap](docs/PLATFORM_ROADMAP.md)
- [Environment template](.env.example)

Apply the migration only to a dedicated new/test project after reviewing it. For this static GitHub Pages build, place the project URL and **publishable** key in `assets/js/supabase-config.js` (that key is public by design; never use a service-role/secret key). Configure Auth email verification, redirect URLs, SMTP and abuse protection, then verify the schema and RLS policies as anonymous and authenticated users before using real partner data. The SQL assertions are in `supabase/tests/core_schema_assertions.sql`. `.env.example` documents the variables for a future Vite-based build; the static pages do not read `.env` files.

## Deployment

The existing GitHub Actions workflow deploys the static root to GitHub Pages when changes reach `main`. After merging, set **Settings → Pages → Source → GitHub Actions**. Domain and DNS configuration are separate and require a domain you control.

## Commercial launch checklist

- Verify destination facts, image licensing and attribution requirements
- Implement and test sign-in, onboarding, listing review and enquiry notifications end-to-end
- Configure production domain, canonical URLs, sitemap and robots rules
- Publish privacy, data-retention, account deletion and advertising/affiliate disclosures
- Add rate limiting, abuse controls, monitoring, backup and restore testing
- Integrate payment providers only after pricing, refund and legal terms are defined
- Test accessibility, performance, broken links and Core Web Vitals

Potential revenue streams include disclosed affiliate referrals, clearly labelled sponsorships, business subscriptions and advertising. None should be represented as active until the integration works and has been verified.
