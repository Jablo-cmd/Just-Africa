-- Email notification for new contact messages.
-- An AFTER INSERT trigger asynchronously calls the notify-contact Edge Function with only the message id.
-- Failure to enqueue never blocks or fails the visitor's submission. The function URL below is specific
-- to the Just-Africa Supabase project; change it if the project changes.

create extension if not exists pg_net with schema extensions;

alter table public.contact_messages add column notified_at timestamptz;
grant select, update on public.contact_messages to service_role;

create or replace function public.notify_contact_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://bgaxvnbffgkllbyooqtu.supabase.co/functions/v1/notify-contact',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('id', new.id),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'contact notification enqueue failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_contact_message() from public, anon, authenticated;

create trigger notify_contact_message after insert on public.contact_messages
for each row execute function public.notify_contact_message();
