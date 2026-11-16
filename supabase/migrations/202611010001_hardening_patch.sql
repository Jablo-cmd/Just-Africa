-- Recorded from the live Just-Africa Supabase project (applied as "just_africa_hardening_patch",
-- version 20261101200824) so the repository matches the deployed database. Apply after the core migration.

-- 1. Hide internal verification fields from the public Data API.
revoke select on public.businesses from anon, authenticated;
grant select (id, owner_id, name, slug, business_type, status, description, email, phone, website_url, country_code, region, city, address_public, latitude, longitude, logo_url, cover_image_url, verified_at, created_at, updated_at)
  on public.businesses to anon, authenticated;

-- Owners and admins read verification details through this function only.
create or replace function public.get_business_verification(p_business_id uuid)
returns table (verification_notes text, verified_by uuid, verified_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select b.verification_notes, b.verified_by, b.verified_at
  from public.businesses b
  where b.id = p_business_id
    and (b.owner_id = (select auth.uid()) or public.is_admin())
$$;
revoke all on function public.get_business_verification(uuid) from public;
grant execute on function public.get_business_verification(uuid) to authenticated;

-- 2 + 3. Listing guard: allow service role / SQL editor, force re-review of edited published listings.
create or replace function public.guard_listing_publication()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if coalesce(public.current_member_role()::text, '') = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then
      raise exception 'Listings must be submitted for review before publication';
    end if;
    new.published_at := null;
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status not in ('draft', 'pending_review', 'archived') then
    raise exception 'Only platform administrators can approve or publish listings';
  end if;

  if old.status = 'published' and new.status = 'published'
     and row(new.business_id, new.destination_id, new.title, new.slug, new.listing_type, new.summary, new.description,
             new.price_from, new.price_currency, new.price_unit, new.booking_url, new.contact_email,
             new.features, new.accessibility_info, new.cancellation_summary)
         is distinct from
         row(old.business_id, old.destination_id, old.title, old.slug, old.listing_type, old.summary, old.description,
             old.price_from, old.price_currency, old.price_unit, old.booking_url, old.contact_email,
             old.features, old.accessibility_info, old.cancellation_summary) then
    new.status := 'pending_review';
  end if;

  new.published_at := old.published_at;
  return new;
end;
$$;

drop trigger if exists guard_listing_publication on public.listings;
create trigger guard_listing_publication before insert or update on public.listings
for each row execute function public.guard_listing_publication();

-- 4. Verified owners can edit their business; protected fields stay locked.
create or replace function public.guard_business_changes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or coalesce(public.current_member_role()::text, '') = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_at := null;
    new.verified_by := null;
    new.verification_notes := null;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Business ownership cannot be changed';
  end if;

  new.verified_at := old.verified_at;
  new.verified_by := old.verified_by;
  new.verification_notes := old.verification_notes;

  if new.status is distinct from old.status
     and not (old.status in ('draft', 'pending_review', 'rejected') and new.status in ('draft', 'pending_review')) then
    raise exception 'Only platform administrators can change verification status';
  end if;

  if old.status = 'verified'
     and (new.name is distinct from old.name
          or new.country_code is distinct from old.country_code
          or new.slug is distinct from old.slug) then
    new.status := 'pending_review';
  end if;

  return new;
end;
$$;

create trigger guard_business_changes before insert or update on public.businesses
for each row execute function public.guard_business_changes();

drop policy if exists "owners update own unverified businesses" on public.businesses;
create policy "owners update own businesses" on public.businesses for update to authenticated
using (owner_id = (select auth.uid()) and status in ('draft', 'pending_review', 'rejected', 'verified'))
with check (owner_id = (select auth.uid()) and status in ('draft', 'pending_review', 'rejected', 'verified'));

-- 5. Account deletion: removing a user removes their businesses instead of being blocked.
alter table public.businesses drop constraint businesses_owner_id_fkey;
alter table public.businesses add constraint businesses_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;
