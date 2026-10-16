# Just Africa — platform delivery roadmap

## Product target

An Africa-wide discovery platform connecting travellers to verified accommodation providers, safari and tour operators, local guides, transport providers and meaningful experiences. The platform should earn trust first, then monetise transparent discovery and referrals.

## Delivery phases

### Phase 1 — Foundation
- [x] Initial responsive public site and destination search
- [x] Core relational schema for profiles, destinations, businesses, listings, enquiries, editorial content, sponsorships, referrals and reports
- [x] Row-level security baseline
- [ ] Provision a dedicated Supabase project and apply migration
- [ ] Test policies using anonymous and authenticated role scenarios
- [ ] Set production domain and deploy workflow

### Phase 2 — Working product
- [x] Scaffold email/password sign-up, sign-in, sign-out and password recovery
- [x] Traveller dashboard shell and saved-listing controls
- [x] Business onboarding and owner dashboard shell
- [x] Create listing and submit for review workflow
- [x] Admin business verification and listing approval controls
- [x] Public verified-listing directory with filters and enquiry submission
- [ ] Connect the UI to a dedicated Supabase project and verify every flow end-to-end
- [ ] Configure email delivery/notifications and abuse protection
- [ ] Add secure listing image uploads and business/listing editing
- [ ] Complete editor tools for destination and article publishing

### Phase 3 — Trust, discovery and SEO
- [ ] Verified status rules and visible verification explanation
- [ ] Listing report and takedown workflow
- [ ] Country/city/park landing pages, canonical URLs, sitemap and structured data
- [ ] Image rights and attribution records
- [ ] Accessibility, responsive QA, performance budgets and broken-link checks
- [ ] Privacy notice, data retention, account deletion and consent management

### Phase 4 — Revenue
- [ ] Affiliate outbound-link tracking with transparent disclosure
- [ ] Sponsored listing inventory, start/end dates and visible "Sponsored" labels
- [ ] Business subscription tiers and invoices
- [ ] Payment provider integration only after pricing, legal terms and refund handling are agreed
- [ ] Ad placements and consent controls appropriate to target markets
- [ ] Reporting for impressions, clicks, enquiries and conversions

### Phase 5 — Scale
- [ ] Moderation queues and audit logs
- [ ] Search relevance and regional filters
- [ ] Partner API/import tools with permissions and rate limits
- [ ] Operational monitoring, backups, restore drills and incident runbook
- [ ] Localisation and multi-currency display
- [ ] Analytics and conversion experiments that respect privacy choices

## Definition of done

A feature is not complete merely because a page exists. It must have an agreed user flow, authorization rules, error/loading/empty states, tests, accessibility checks, deployment instructions and verification against the live service. Never advertise bookings, payments, verification or integrations until they work end-to-end.
