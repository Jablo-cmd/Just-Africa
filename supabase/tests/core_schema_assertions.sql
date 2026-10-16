-- Run after applying the core migration in a disposable/test Supabase project.
-- Each query should return the expected rows; any missing item indicates setup is incomplete.

select table_name, row_security
from information_schema.tables t
join pg_class c on c.relname = t.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.table_schema
where t.table_schema = 'public'
  and t.table_name in (
    'profiles','destinations','businesses','listings','listing_images',
    'favourites','inquiries','articles','sponsorships','affiliate_clicks','reports'
  )
order by table_name;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','destinations','businesses','listings','listing_images',
    'favourites','inquiries','articles','sponsorships','affiliate_clicks','reports'
  )
order by tablename, policyname;

select slug, name, is_published
from public.destinations
order by name;
