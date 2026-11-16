-- Just Africa hardening, part 2 (applies after 202610160001_just_africa_core.sql and
-- 202611010001_hardening_patch.sql). Listing/business guards live in the patch; this adds:
--   * least-privilege table grants (Supabase default privileges grant ALL to anon/authenticated)
--   * column-level insert allowlists on public tables
--   * length/format limits on public free-text
--   * server-recorded verified_by, signup display_name truncation
--   * EXECUTE revokes on internal SECURITY DEFINER functions
-- Rate limiting / CAPTCHA for public inserts is NOT solved in SQL: configure it in Supabase
-- (Auth + API rate limits, Turnstile/hCaptcha) or via an Edge Function.

-- 1. Reset table privileges for the public API roles, then grant only what the app needs. RLS stays in force.
revoke all on public.profiles, public.destinations, public.businesses, public.listings, public.listing_images,
  public.favourites, public.inquiries, public.articles, public.sponsorships, public.affiliate_clicks, public.reports
  from anon, authenticated;

-- Public discovery reads (businesses is column-level: verification notes/actor stay private).
grant select on public.destinations, public.listings, public.listing_images, public.articles, public.sponsorships
  to anon, authenticated;
grant select (id, owner_id, name, slug, business_type, status, description, email, phone, website_url, country_code, region, city, address_public, latitude, longitude, logo_url, cover_image_url, verified_at, created_at, updated_at)
  on public.businesses to anon, authenticated;

-- Signed-in members.
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, country_code) on public.profiles to authenticated;
grant insert, update, delete on public.destinations, public.businesses, public.listings, public.listing_images,
  public.articles, public.sponsorships to authenticated;
grant select, insert, update, delete on public.favourites to authenticated;
grant select on public.inquiries, public.affiliate_clicks, public.reports to authenticated;
grant update (status, business_reply, replied_at) on public.inquiries to authenticated;
grant update, delete on public.reports to authenticated;   -- admin-only via RLS

-- 2. Public inserts: column allowlists so senders cannot forge status/reply/review fields.
grant insert (listing_id, business_id, traveller_id, traveller_name, traveller_email,
              traveller_country, travel_start, travel_end, party_size, message)
  on public.inquiries to anon, authenticated;
grant insert (listing_id, reporter_id, reason, details) on public.reports to anon, authenticated;
grant insert (listing_id, partner_name, destination_url, referral_code)
  on public.affiliate_clicks to anon, authenticated;

-- Future tables/functions created by migrations are not exposed to the API roles automatically.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 3. Length / format limits on public free-text (NOT VALID: enforced for new rows, safe on existing data).
alter table public.inquiries
  add constraint inquiry_name_length check (char_length(traveller_name) between 1 and 120) not valid,
  add constraint inquiry_email_format check (
    char_length(traveller_email) <= 254 and traveller_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) not valid;

alter table public.reports
  add constraint report_reason_length check (char_length(reason) between 1 and 200) not valid,
  add constraint report_details_length check (char_length(details) <= 5000) not valid;

alter table public.affiliate_clicks
  add constraint affiliate_url_length check (char_length(destination_url) <= 2000) not valid,
  add constraint affiliate_ref_length check (referral_code is null or char_length(referral_code) <= 100) not valid;

-- 4. Signup must not fail on an over-long display name supplied via metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(new.email,'@',1)), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5. Record which admin verified a business (admins bypass guard_business_changes, so do it here).
create or replace function public.record_business_verification()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and coalesce(public.current_member_role()::text, '') = 'admin'
     and new.status = 'verified'
     and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    new.verified_by := (select auth.uid());
    new.verified_at := now();
  end if;
  return new;
end;
$$;

create trigger record_business_verification before insert or update on public.businesses
for each row execute function public.record_business_verification();

-- 6. Internal SECURITY DEFINER functions must not be callable through /rest/v1/rpc.
--    (is_admin/current_member_role stay executable: RLS policies call them for anon and authenticated.)
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_business_verification() from public, anon, authenticated;
revoke all on function public.guard_listing_publication() from public, anon, authenticated;
revoke all on function public.guard_business_changes() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.become_business_owner() from public, anon;
revoke all on function public.get_business_verification(uuid) from public, anon;
grant execute on function public.become_business_owner() to authenticated;
grant execute on function public.get_business_verification(uuid) to authenticated;
