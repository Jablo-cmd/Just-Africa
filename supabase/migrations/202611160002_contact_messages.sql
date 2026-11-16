-- Public contact form. Messages are stored privately; only admins can read or triage them.
-- No email address is published anywhere on the site. Rate limiting / CAPTCHA for this public insert
-- must be configured in Supabase (or an Edge Function), like the other public forms.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null default 'general' check (topic in ('general','privacy','partnership','listing','other')),
  message text not null,
  status text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz not null default now(),
  constraint contact_name_length check (char_length(name) between 1 and 120),
  constraint contact_email_format check (
    char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint contact_message_length check (char_length(message) between 10 and 5000)
);

create index contact_messages_status_idx on public.contact_messages(status, created_at desc);

alter table public.contact_messages enable row level security;

create policy "anyone can send a contact message" on public.contact_messages for insert to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy "admins read contact messages" on public.contact_messages for select to authenticated
using ((select public.is_admin()));
create policy "admins triage contact messages" on public.contact_messages for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete contact messages" on public.contact_messages for delete to authenticated
using ((select public.is_admin()));

-- Least privilege: senders choose only their own content; status is admin-controlled.
revoke all on public.contact_messages from anon, authenticated;
grant insert (name, email, topic, message, user_id) on public.contact_messages to anon, authenticated;
grant select, delete on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;
