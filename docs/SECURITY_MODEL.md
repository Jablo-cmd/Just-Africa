# Just Africa security model

## Roles

- **Traveller:** browse public destinations/listings, manage their own profile and favourites, send enquiries.
- **Business owner:** manage businesses they own and their listing content; listings require platform approval to become public.
- **Editor:** maintain destination and article content.
- **Admin:** verify/suspend businesses, approve listings, manage sponsorships and moderate reports.

Roles live in `public.profiles.role`. Public signup creates only a traveller profile. Authorization must never trust user-editable metadata or a client-side role selector.

## Public/private data

Public: published destinations, published editorial content, verified businesses, and published listings belonging to verified businesses; currently active approved sponsorship labels.

Private: traveller profiles, unpublished business drafts, listing drafts, personal enquiry details, reports and affiliate performance. A business owner can access only their own business records and associated enquiries.

## Controls required before launch

- Apply migration in a dedicated project and inspect all RLS policies.
- Test anonymous and authenticated requests directly against the Data API.
- Configure Auth email verification, allowed redirect URLs, SMTP, rate limits and abuse protection.
- Use private object storage and signed uploads; validate file type, size and ownership server-side.
- Add rate limiting/CAPTCHA to public enquiries and report submissions.
- Escape/render user-generated descriptions safely; never inject untrusted HTML.
- Implement account deletion, data export and personal-data retention rules.
- Add audit logs for administrative approvals and business verification.
- Validate outbound affiliate URLs server-side and only allow HTTPS destinations.
- Use verified webhooks for any future payment/subscription system.
- Never put Supabase secret/service-role keys in browser code or Git.
- Verify backups and perform a restore drill before accepting partner data.

The migration is a baseline, not a substitute for penetration testing or legal review.
