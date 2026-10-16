-- Just Africa core platform schema
-- Apply to a NEW Supabase project after reviewing the deployment guide.
-- This migration intentionally does not create auth users or seed fake businesses.

create extension if not exists pgcrypto;

create type public.member_role as enum ('traveller', 'business_owner', 'editor', 'admin');
create type public.business_status as enum ('draft', 'pending_review', 'verified', 'rejected', 'suspended');
create type public.listing_type as enum ('accommodation', 'safari', 'tour', 'guide', 'restaurant', 'transport', 'experience');
create type public.listing_status as enum ('draft', 'pending_review', 'published', 'rejected', 'archived');
create type public.inquiry_status as enum ('new', 'in_progress', 'answered', 'closed');
create type public.article_status as enum ('draft', 'review', 'published', 'archived');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.member_role not null default 'traveller',
  country_code char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 100)
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.destinations(id) on delete set null,
  slug text not null unique,
  name text not null,
  destination_type text not null default 'country' check (destination_type in ('continent','region','country','city','island','park','area')),
  country_code char(2),
  summary text not null default '',
  description text not null default '',
  hero_image_url text,
  best_for text[] not null default '{}',
  seo_title text,
  seo_description text,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_name_length check (char_length(name) between 1 and 120),
  constraint destination_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  business_type text not null check (business_type in ('accommodation','safari_operator','tour_operator','local_guide','restaurant','transport','tourism_organisation','other')),
  status public.business_status not null default 'draft',
  description text not null default '',
  email text,
  phone text,
  website_url text,
  country_code char(2) not null,
  region text,
  city text,
  address_public text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  logo_url text,
  cover_image_url text,
  verification_notes text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_name_length check (char_length(name) between 2 and 160),
  constraint business_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint business_coordinates_pair check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete set null,
  title text not null,
  slug text not null unique,
  listing_type public.listing_type not null,
  status public.listing_status not null default 'draft',
  summary text not null default '',
  description text not null default '',
  price_from numeric(12,2),
  price_currency char(3),
  price_unit text,
  booking_url text,
  contact_email text,
  features text[] not null default '{}',
  accessibility_info text,
  cancellation_summary text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_title_length check (char_length(title) between 3 and 180),
  constraint listing_price_nonnegative check (price_from is null or price_from >= 0),
  constraint listing_currency_pair check (price_from is null or price_currency is not null)
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(listing_id, storage_path)
);

create table public.favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, listing_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  traveller_id uuid references auth.users(id) on delete set null,
  traveller_name text not null,
  traveller_email text not null,
  traveller_country char(2),
  travel_start date,
  travel_end date,
  party_size integer,
  message text not null,
  status public.inquiry_status not null default 'new',
  business_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inquiry_party_size check (party_size is null or party_size between 1 and 1000),
  constraint inquiry_dates check (travel_start is null or travel_end is null or travel_end >= travel_start),
  constraint inquiry_message_length check (char_length(message) between 10 and 5000)
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  destination_id uuid references public.destinations(id) on delete set null,
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body_markdown text not null default '',
  cover_image_url text,
  category text not null default 'travel',
  status public.article_status not null default 'draft',
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  label text not null default 'Sponsored',
  placement text not null check (placement in ('homepage','destination','search','article')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','paused','ended')),
  created_at timestamptz not null default now(),
  constraint sponsorship_dates check (ends_at > starts_at)
);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  partner_name text not null,
  destination_url text not null,
  referral_code text,
  clicked_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  listing_id uuid references public.listings(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_target check (listing_id is not null)
);

create index destinations_parent_idx on public.destinations(parent_id);
create index destinations_published_idx on public.destinations(is_published, is_featured);
create index businesses_owner_idx on public.businesses(owner_id);
create index businesses_discovery_idx on public.businesses(country_code, status);
create index listings_business_idx on public.listings(business_id);
create index listings_discovery_idx on public.listings(status, listing_type, destination_id);
create index listings_published_at_idx on public.listings(published_at desc);
create index inquiries_business_status_idx on public.inquiries(business_id, status, created_at desc);
create index articles_published_idx on public.articles(status, published_at desc);
create index sponsorships_active_idx on public.sponsorships(status, starts_at, ends_at);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger destinations_updated_at before update on public.destinations for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger articles_updated_at before update on public.articles for each row execute function public.set_updated_at();

-- New accounts always begin as travellers. Never accept a privileged role from user metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Non-admin owners may submit listings for review but cannot publish them by direct API calls.
create or replace function public.guard_listing_publication()
returns trigger language plpgsql set search_path = ''
as $
begin
  if (coalesce(public.current_member_role()::text, '') <> 'admin') then
    if tg_op = 'INSERT' and new.status not in ('draft','pending_review') then
      raise exception 'Listings must be submitted for review before publication';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and new.status not in ('draft','pending_review') then
      raise exception 'Only platform administrators can approve or publish listings';
    end if;
  end if;
  return new;
end;
$;

create trigger guard_listing_publication before insert or update of status on public.listings
for each row execute function public.guard_listing_publication();


-- Helper functions read the protected profiles table without creating recursive RLS policies.
create or replace function public.current_member_role()
returns public.member_role language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_member_role() = 'admin', false)
$$;

alter table public.profiles enable row level security;
alter table public.destinations enable row level security;
alter table public.businesses enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favourites enable row level security;
alter table public.inquiries enable row level security;
alter table public.articles enable row level security;
alter table public.sponsorships enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.reports enable row level security;

-- Profiles: members can read/update their own non-role fields; only admins may change roles.
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles update self or admin" on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check ((id = (select auth.uid()) and role = (select public.current_member_role())) or (select public.is_admin()));

-- Public discovery only exposes published records. Editorial/admin changes require elevated role.
create policy "published destinations are public" on public.destinations for select to anon, authenticated
using (is_published or (select public.is_admin()));
create policy "editors manage destinations" on public.destinations for all to authenticated
using ((select public.current_member_role()) in ('editor','admin'))
with check ((select public.current_member_role()) in ('editor','admin'));

create policy "verified businesses public or owner/admin" on public.businesses for select to anon, authenticated
using (status = 'verified' or owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "owners create own businesses" on public.businesses for insert to authenticated
with check (owner_id = (select auth.uid()) and status in ('draft','pending_review'));
create policy "owners update own unverified businesses" on public.businesses for update to authenticated
using ((owner_id = (select auth.uid()) and status in ('draft','pending_review','rejected')) or (select public.is_admin()))
with check ((owner_id = (select auth.uid()) and status in ('draft','pending_review','rejected')) or (select public.is_admin()));
create policy "admins manage businesses" on public.businesses for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "published listings public or owner/admin" on public.listings for select to anon, authenticated
using (
  status = 'published' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'verified')
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  or (select public.is_admin())
);
create policy "business owners create listings" on public.listings for insert to authenticated
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()) and b.status in ('verified','draft','pending_review')));
create policy "business owners update own listings" on public.listings for update to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())) or (select public.is_admin()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())) or (select public.is_admin()));
create policy "admins manage listings" on public.listings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "listing images follow listing visibility" on public.listing_images for select to anon, authenticated
using (exists (select 1 from public.listings l join public.businesses b on b.id=l.business_id where l.id=listing_id and ((l.status='published' and b.status='verified') or b.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy "owners manage own listing images" on public.listing_images for all to authenticated
using (exists (select 1 from public.listings l join public.businesses b on b.id=l.business_id where l.id=listing_id and b.owner_id=(select auth.uid())) or (select public.is_admin()))
with check (exists (select 1 from public.listings l join public.businesses b on b.id=l.business_id where l.id=listing_id and b.owner_id=(select auth.uid())) or (select public.is_admin()));

create policy "members manage own favourites" on public.favourites for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Inquiries are private to their recipient business and the submitting traveller.
create policy "traveller creates inquiry" on public.inquiries for insert to anon, authenticated
with check (
  (traveller_id is null or traveller_id = (select auth.uid()))
  and exists (select 1 from public.listings l join public.businesses b on b.id=l.business_id where l.id=listing_id and l.business_id=inquiries.business_id and l.status='published' and b.status='verified')
);
create policy "traveller or business reads inquiry" on public.inquiries for select to authenticated
using (traveller_id = (select auth.uid()) or exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())) or (select public.is_admin()));
create policy "business replies to inquiry" on public.inquiries for update to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())) or (select public.is_admin()))
with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())) or (select public.is_admin()));

create policy "published articles public" on public.articles for select to anon, authenticated
using ((status='published' and published_at <= now()) or (author_id=(select auth.uid())) or (select public.current_member_role()) in ('editor','admin'));
create policy "authors create articles" on public.articles for insert to authenticated
with check (author_id=(select auth.uid()) and (select public.current_member_role()) in ('editor','admin'));
create policy "editors manage articles" on public.articles for all to authenticated
using ((select public.current_member_role()) in ('editor','admin'))
with check ((select public.current_member_role()) in ('editor','admin'));

create policy "approved active sponsorships public" on public.sponsorships for select to anon, authenticated
using (status='approved' and starts_at <= now() and ends_at > now());
create policy "admins manage sponsorships" on public.sponsorships for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Click events are append-only via the public client; no public reads or edits.
create policy "anyone can record affiliate click" on public.affiliate_clicks for insert to anon, authenticated
with check (char_length(partner_name) between 1 and 120 and destination_url ~ '^https://');
create policy "admins read affiliate clicks" on public.affiliate_clicks for select to authenticated
using ((select public.is_admin()));

create policy "reporters create listing reports" on public.reports for insert to anon, authenticated
with check (listing_id is not null and (reporter_id is null or reporter_id=(select auth.uid())));
create policy "admins manage reports" on public.reports for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Prevent clients from promoting themselves through direct table updates.
revoke all on function public.current_member_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_member_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
