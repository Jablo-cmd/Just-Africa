-- Just Africa hardening migration (applies on top of 202610160001_just_africa_core.sql).
-- Review before applying. Rate limiting / CAPTCHA for public inserts is NOT solved here:
-- configure it in Supabase (Auth + API rate limits, Turnstile/hCaptcha) or via an Edge Function.

-- 1. Public inserts: restrict writable columns so a sender cannot forge reply/status fields.
revoke insert on public.inquiries from anon, authenticated;
grant insert (listing_id, business_id, traveller_id, traveller_name, traveller_email,
              traveller_country, travel_start, travel_end, party_size, message)
  on public.inquiries to anon, authenticated;

revoke insert on public.reports from anon, authenticated;
grant insert (listing_id, reporter_id, reason, details) on public.reports to anon, authenticated;

revoke insert on public.affiliate_clicks from anon, authenticated;
grant insert (listing_id, partner_name, destination_url, referral_code)
  on public.affiliate_clicks to anon, authenticated;

-- 2. Length / format limits on public free-text fields (NOT VALID: new rows only, safe on existing data).
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

-- 3. Signup must not fail on an over-long display name supplied via metadata.
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

-- 4. Edits to a published listing by a non-admin send it back to review, and publication
--    timestamps cannot be set by owners.
create or replace function public.guard_published_listing_edits()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if coalesce(public.current_member_role()::text, '') <> 'admin' then
    if tg_op = 'INSERT' then
      new.published_at := null;
    else
      new.published_at := old.published_at;
      if old.status = 'published' and new.status = 'published' then
        new.status := 'pending_review';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_published_listing_edits before insert or update on public.listings
for each row execute function public.guard_published_listing_edits();

-- 5. Verification audit trail: only admins set verification fields, and the actor is recorded server-side.
create or replace function public.guard_business_verification()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if coalesce(public.current_member_role()::text, '') = 'admin' then
    if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
      new.verified_by := (select auth.uid());
      new.verified_at := now();
    end if;
  elsif tg_op = 'INSERT' then
    new.verified_by := null;
    new.verified_at := null;
    new.verification_notes := null;
  else
    new.verified_by := old.verified_by;
    new.verified_at := old.verified_at;
    new.verification_notes := old.verification_notes;
  end if;
  return new;
end;
$$;

create trigger guard_business_verification before insert or update on public.businesses
for each row execute function public.guard_business_verification();
