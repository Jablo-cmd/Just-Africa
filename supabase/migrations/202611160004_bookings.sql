-- Hotel room types and booking requests (stage 1: no payments on the platform).
-- Guests request a stay; the hotel confirms or declines; confirmed bookings hold inventory.
-- All writes to bookings go through SECURITY DEFINER functions that validate input, compute prices
-- server-side from room_types, and lock the room type row so availability cannot be double-booked.

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null,
  description text not null default '',
  max_guests integer not null default 2,
  units_total integer not null default 1,
  price_per_night numeric(12,2) not null,
  price_currency char(3) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_name_length check (char_length(name) between 2 and 120),
  constraint room_description_length check (char_length(description) <= 2000),
  constraint room_max_guests check (max_guests between 1 and 20),
  constraint room_units check (units_total between 1 and 500),
  constraint room_price_positive check (price_per_night > 0),
  constraint room_currency_format check (price_currency ~ '^[A-Z]{3}$')
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  guest_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  check_in date not null,
  check_out date not null,
  nights integer generated always as (check_out - check_in) stored,
  guests integer not null,
  rooms integer not null default 1,
  total_amount numeric(12,2) not null,
  currency char(3) not null,
  notes text,
  status text not null default 'requested' check (status in ('requested','confirmed','declined','cancelled')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_dates check (check_out > check_in and check_out - check_in <= 60),
  constraint booking_guests check (guests between 1 and 200),
  constraint booking_rooms check (rooms between 1 and 10),
  constraint booking_name_length check (char_length(guest_name) between 1 and 120),
  constraint booking_email_format check (
    char_length(guest_email) <= 254 and guest_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint booking_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint booking_total_nonnegative check (total_amount >= 0)
);

create index room_types_listing_idx on public.room_types(listing_id);
create index bookings_room_dates_idx on public.bookings(room_type_id, status, check_in, check_out);
create index bookings_business_idx on public.bookings(business_id, status, created_at desc);
create index bookings_guest_idx on public.bookings(guest_id, created_at desc);

create trigger room_types_updated_at before update on public.room_types for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

alter table public.room_types enable row level security;
alter table public.bookings enable row level security;

-- Room types are public only while their listing is published by a verified business.
create policy "room types follow listing visibility" on public.room_types for select to anon, authenticated
using (
  exists (
    select 1 from public.listings l join public.businesses b on b.id = l.business_id
    where l.id = room_types.listing_id
      and ((l.status = 'published' and b.status = 'verified' and room_types.is_active) or b.owner_id = (select auth.uid()))
  )
  or (select public.is_admin())
);
create policy "owners manage own room types" on public.room_types for all to authenticated
using (
  exists (select 1 from public.listings l join public.businesses b on b.id = l.business_id
          where l.id = room_types.listing_id and b.owner_id = (select auth.uid()))
  or (select public.is_admin())
)
with check (
  exists (select 1 from public.listings l join public.businesses b on b.id = l.business_id
          where l.id = room_types.listing_id and l.listing_type = 'accommodation' and b.owner_id = (select auth.uid()))
  or (select public.is_admin())
);

-- Bookings are private to the guest, the receiving hotel and admins. No direct writes: use the functions below.
create policy "guest, hotel or admin reads booking" on public.bookings for select to authenticated
using (
  guest_id = (select auth.uid())
  or exists (select 1 from public.businesses b where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
  or (select public.is_admin())
);

revoke all on public.room_types, public.bookings from anon, authenticated;
grant select on public.room_types to anon, authenticated;
grant insert, update, delete on public.room_types to authenticated;
grant select on public.bookings to authenticated;

-- Rooms still free for every night of [check_in, check_out). Only confirmed bookings hold inventory.
create or replace function public.room_free_units(p_room_type_id uuid, p_check_in date, p_check_out date)
returns integer language sql stable security definer set search_path = ''
as $$
  select case
    when p_check_in is null or p_check_out is null or p_check_out <= p_check_in or p_check_out - p_check_in > 60 then 0
    else greatest(coalesce((
      select min(rt.units_total - coalesce(u.used, 0))
      from public.room_types rt
      cross join lateral generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') as g(night)
      left join lateral (
        select sum(bk.rooms)::integer as used
        from public.bookings bk
        where bk.room_type_id = rt.id and bk.status = 'confirmed'
          and bk.check_in <= g.night::date and bk.check_out > g.night::date
      ) u on true
      where rt.id = p_room_type_id and rt.is_active
    ), 0), 0)
  end
$$;

create or replace function public.request_booking(
  p_room_type_id uuid, p_check_in date, p_check_out date, p_guests integer, p_rooms integer,
  p_guest_name text, p_guest_email text, p_notes text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rt public.room_types%rowtype;
  l public.listings%rowtype;
  b public.businesses%rowtype;
  nights integer;
  free integer;
  open_requests integer;
  new_id uuid;
begin
  if uid is null then raise exception 'Sign in to request a booking'; end if;

  -- Lock the room type so concurrent requests are evaluated one at a time.
  select * into rt from public.room_types where id = p_room_type_id for update;
  if not found or not rt.is_active then raise exception 'This room is not available'; end if;
  select * into l from public.listings where id = rt.listing_id;
  select * into b from public.businesses where id = l.business_id;
  if l.status <> 'published' or b.status <> 'verified' or l.listing_type <> 'accommodation' then
    raise exception 'This property is not open for booking requests';
  end if;

  if p_check_in is null or p_check_out is null or p_check_in < current_date then
    raise exception 'Check-in must be today or later';
  end if;
  nights := p_check_out - p_check_in;
  if nights < 1 or nights > 60 then raise exception 'Stays must be between 1 and 60 nights'; end if;
  if p_rooms is null or p_rooms < 1 or p_rooms > 10 then raise exception 'Choose between 1 and 10 rooms'; end if;
  if p_guests is null or p_guests < 1 or p_guests > rt.max_guests * p_rooms then
    raise exception 'Too many guests for the selected rooms';
  end if;

  select count(*) into open_requests from public.bookings where guest_id = uid and status = 'requested';
  if open_requests >= 10 then raise exception 'You have too many open booking requests'; end if;

  free := public.room_free_units(p_room_type_id, p_check_in, p_check_out);
  if p_rooms > free then raise exception 'Not enough rooms available for those dates'; end if;

  insert into public.bookings (room_type_id, listing_id, business_id, guest_id, guest_name, guest_email,
                               check_in, check_out, guests, rooms, total_amount, currency, notes)
  values (rt.id, l.id, b.id, uid, btrim(p_guest_name), btrim(p_guest_email),
          p_check_in, p_check_out, p_guests, p_rooms, nights * rt.price_per_night * p_rooms, rt.price_currency,
          nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.respond_to_booking(p_booking_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bk public.bookings%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if p_decision not in ('confirmed', 'declined') then raise exception 'Decision must be confirmed or declined'; end if;

  select * into bk from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  perform 1 from public.room_types where id = bk.room_type_id for update;   -- serialise with new requests
  select * into bk from public.bookings where id = p_booking_id for update;

  if not (public.is_admin() or exists (select 1 from public.businesses b where b.id = bk.business_id and b.owner_id = uid)) then
    raise exception 'Only the property or an administrator can answer this request';
  end if;
  if bk.status <> 'requested' then raise exception 'This request has already been answered'; end if;
  if p_decision = 'confirmed' and bk.rooms > public.room_free_units(bk.room_type_id, bk.check_in, bk.check_out) then
    raise exception 'Not enough rooms left for those dates';
  end if;

  update public.bookings set status = p_decision, decided_at = now() where id = bk.id;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bk public.bookings%rowtype;
  is_host boolean;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into bk from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  is_host := public.is_admin() or exists (select 1 from public.businesses b where b.id = bk.business_id and b.owner_id = uid);
  if not (is_host or bk.guest_id = uid) then raise exception 'You cannot cancel this booking'; end if;
  if bk.status not in ('requested', 'confirmed') then raise exception 'This booking can no longer be cancelled'; end if;
  if not is_host and bk.check_in < current_date then raise exception 'Past stays cannot be cancelled'; end if;
  update public.bookings set status = 'cancelled', decided_at = now() where id = bk.id;
end;
$$;

revoke all on function public.room_free_units(uuid, date, date) from public, anon, authenticated;
revoke all on function public.request_booking(uuid, date, date, integer, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.respond_to_booking(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.room_free_units(uuid, date, date) to anon, authenticated;
grant execute on function public.request_booking(uuid, date, date, integer, integer, text, text, text) to authenticated;
grant execute on function public.respond_to_booking(uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
