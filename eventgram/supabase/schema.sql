-- Eventgram database
-- Run this whole file once in Supabase: SQL Editor → New query → paste → Run.
-- Then put your own email in the last line and run that line.
-- Safe to run again after updates: it only adds what's missing.

create extension if not exists pgcrypto;

-- ───────────────────────── settings ─────────────────────────
-- One row. owner_emails = people who manage clubs and their logins.
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  owner_emails text[] not null default array[]::text[]
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ───────────────────────── clubs ─────────────────────────
-- Each club has one login (username + password) created by the owner.
-- Supabase stores the password scrambled (bcrypt); nobody can read it back.
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  category text not null default 'other',
  instagram text,
  -- How EventHub writes this club in "Conducted By" (e.g. VITSOL), so synced events get matched to it.
  eventhub_names text[] not null default array[]::text[],
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── events ─────────────────────────
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'club' check (source in ('eventhub','club')),
  eventhub_eid text unique,
  club_id uuid references clubs(id) on delete set null,

  -- Filled by the EventHub sync (or by the club for events not on EventHub)
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '',
  category text not null default 'other'
    check (category in ('tech','cultural','sports','workshop','fest','social','other')),
  event_date date not null,
  start_time time,
  end_time time,
  venue text not null default '',
  fee integer not null default 0 check (fee >= 0),
  open_to text,                 -- "VITian", "VITian/Non-VITian"
  team_size text,               -- "1", "1-3"
  eh_conducted_by text,         -- EventHub's "Conducted By"
  last_seen_at timestamptz,     -- last time the sync saw it on EventHub
  eh_detail_at timestamptz,     -- last time the sync read the event's own EventHub page

  -- Added by the club on the club desk
  od_status text check (od_status in ('yes','no')),
  od_from time,
  od_to time,
  od_note text,
  deadline date,
  hook text check (hook is null or char_length(hook) <= 120),
  highlights text,
  instagram_url text check (instagram_url is null or instagram_url ~* '^https://'),
  contact text,
  club_updated_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table events add column if not exists eh_detail_at timestamptz;
create index if not exists events_date_idx on events (event_date);
create index if not exists events_club_idx on events (club_id);

create table if not exists event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kind text not null check (kind in ('poster','reel')),
  path text not null,            -- path inside the "media" storage bucket
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_media_event_idx on event_media (event_id);

-- One row per EventHub sync, so the app can show "last synced" and stop overlapping runs.
create table if not exists sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  message text,
  added int not null default 0,
  updated int not null default 0,
  removed int not null default 0
);

-- ───────────────────────── helpers ─────────────────────────
create or replace function current_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_settings where current_email() <> '' and current_email() = any (select lower(unnest(owner_emails))))
$$;

-- The club this login belongs to (null for the owner and everyone else)
create or replace function my_club_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from clubs where auth_user_id = auth.uid() limit 1
$$;

-- May the signed-in person act for this club?
create or replace function is_club(club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or (club is not null and exists (select 1 from clubs where id = club and auth_user_id = auth.uid()))
$$;

-- Nobody signs up on their own: only owner emails, and club logins the owner pre-created.
create or replace function check_signup_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare e text := lower(new.email);
begin
  if e is not null and (
       e = any (select lower(unnest(owner_emails)) from app_settings where id = 1)
    or exists (select 1 from clubs where auth_user_id is null and e = username || '@clubs.eventgram.app')
  ) then
    return new;
  end if;
  raise exception 'Accounts are created by the Eventgram owner';
end $$;
drop trigger if exists check_signup_email on auth.users;
create trigger check_signup_email before insert on auth.users
  for each row execute function check_signup_email();

-- Clubs can't change what came from EventHub (name, date, venue, fee...); the sync and the owner can.
create or replace function protect_eventhub_fields() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  if old.source = 'eventhub' and coalesce(auth.role(), '') <> 'service_role' and not is_owner() then
    new.source := old.source;
    new.eventhub_eid := old.eventhub_eid;
    new.title := old.title;
    new.description := old.description;
    new.event_date := old.event_date;
    new.venue := old.venue;
    new.fee := old.fee;
    new.open_to := old.open_to;
    new.team_size := old.team_size;
    new.eh_conducted_by := old.eh_conducted_by;
    new.last_seen_at := old.last_seen_at;
    new.eh_detail_at := old.eh_detail_at;
    new.start_time := coalesce(old.start_time, new.start_time);
  end if;
  return new;
end $$;
drop trigger if exists events_protect on events;
create trigger events_protect before update on events
  for each row execute function protect_eventhub_fields();

-- ───────────────────────── access rules ─────────────────────────
alter table app_settings enable row level security;
alter table clubs enable row level security;
alter table events enable row level security;
alter table event_media enable row level security;
alter table sync_runs enable row level security;

drop policy if exists "owners read settings" on app_settings;
create policy "owners read settings" on app_settings for select using (is_owner());

-- clubs: everyone reads names; changes go through the owner page (server, service key)
drop policy if exists "clubs readable" on clubs;
create policy "clubs readable" on clubs for select using (true);
drop policy if exists "owners manage clubs" on clubs;
create policy "owners manage clubs" on clubs for all using (is_owner()) with check (is_owner());

-- events: everyone reads. A club edits its own events and can claim EventHub events no club has yet.
drop policy if exists "events readable" on events;
create policy "events readable" on events for select using (true);
drop policy if exists "clubs add events" on events;
create policy "clubs add events" on events for insert
  with check (source = 'club' and is_club(club_id));
drop policy if exists "clubs edit events" on events;
create policy "clubs edit events" on events for update
  using (is_club(club_id) or (club_id is null and my_club_id() is not null))
  with check (is_club(club_id));
drop policy if exists "clubs delete own events" on events;
create policy "clubs delete own events" on events for delete
  using (is_owner() or (source = 'club' and is_club(club_id)));

drop policy if exists "media readable" on event_media;
create policy "media readable" on event_media for select using (true);
drop policy if exists "clubs manage media" on event_media;
create policy "clubs manage media" on event_media for all
  using (is_club((select club_id from events where id = event_id)))
  with check (is_club((select club_id from events where id = event_id)));

drop policy if exists "sync status readable" on sync_runs;
create policy "sync status readable" on sync_runs for select using (true);

-- ───────────────────────── storage ─────────────────────────
-- Public bucket for posters and reels. Files live at <club_id>/<event_id>/<file>. 50 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "clubs upload media" on storage.objects;
create policy "clubs upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and is_club(((storage.foldername(name))[1])::uuid));
drop policy if exists "clubs delete media" on storage.objects;
create policy "clubs delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and is_club(((storage.foldername(name))[1])::uuid));

-- ───────────────────────── make yourself the owner ─────────────────────────
-- Replace the email below with the one you'll log in with, then run this line.
update app_settings set owner_emails = array['you@example.com'] where id = 1;
