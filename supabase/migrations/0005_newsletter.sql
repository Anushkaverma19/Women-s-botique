create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- No public select policy: subscribing is write-only from the client's
-- perspective. Reads happen only via the service-role client (e.g. an
-- admin export), never through the anon/authenticated role.
drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
create policy "newsletter_public_insert"
  on public.newsletter_subscribers for insert
  with check (true);
