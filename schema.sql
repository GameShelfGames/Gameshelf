-- GameShelf — supabase/schema.sql
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent where practical).
-- Design: the browser can READ leaderboards and edit ONLY its own display name.
-- Scores can be written ONLY by the submit-score Edge Function (service role), never directly.

-- ───────── Tables ─────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ('Player' || (floor(random() * 9000) + 1000)::int::text),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint display_name_length check (char_length(display_name) between 2 and 24),
  constraint display_name_chars  check (display_name !~ '[[:cntrl:]<>]')
);

create table if not exists public.games (
  id        text primary key,
  title     text not null,
  min_score bigint not null default 0,
  max_score bigint not null,
  enabled   boolean not null default true,
  created_at timestamptz not null default now(),
  constraint game_id_format  check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  constraint score_bounds    check (min_score >= 0 and max_score >= min_score)
);

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  game_id    text   not null references public.games (id) on delete cascade,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  score      bigint not null check (score >= 0),
  created_at timestamptz not null default now()
);

-- ───────── Indexes ─────────
create index if not exists scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index if not exists scores_user_game_idx  on public.scores (user_id, game_id, score desc);
create index if not exists scores_user_time_idx  on public.scores (user_id, created_at desc);   -- rate limiting

-- ───────── Best score per player per game (used by the website) ─────────
-- security_invoker: the view obeys the caller's RLS, which allows public reads below.
create or replace view public.leaderboard_best with (security_invoker = true) as
  select distinct on (s.game_id, s.user_id)
         s.game_id, s.user_id, p.display_name, s.score, s.created_at
  from public.scores s
  join public.profiles p on p.id = s.user_id
  order by s.game_id, s.user_id, s.score desc, s.created_at asc;

-- ───────── Triggers ─────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Every new auth user (including anonymous guests) gets a profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill profiles for users that existed before this script ran.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ───────── Row Level Security ─────────
alter table public.profiles enable row level security;
alter table public.games    enable row level security;
alter table public.scores   enable row level security;

drop policy if exists "profiles are public"      on public.profiles;
drop policy if exists "update own profile"       on public.profiles;
drop policy if exists "enabled games are public" on public.games;
drop policy if exists "scores are public"        on public.scores;

create policy "profiles are public"      on public.profiles for select to anon, authenticated using (true);
create policy "update own profile"       on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "enabled games are public" on public.games    for select to anon, authenticated using (enabled);
create policy "scores are public"        on public.scores   for select to anon, authenticated using (true);
-- No INSERT/UPDATE/DELETE policies on scores or games: clients cannot write them.

-- Defense in depth: also remove the table privileges.
revoke insert, update, delete, truncate on public.scores   from anon, authenticated;
revoke insert, update, delete, truncate on public.games    from anon, authenticated;
revoke insert, delete, truncate         on public.profiles from anon, authenticated;
revoke update                           on public.profiles from anon, authenticated;
grant  update (display_name)            on public.profiles to authenticated;   -- only this column
grant  select on public.profiles, public.games, public.scores, public.leaderboard_best to anon, authenticated;

-- ───────── Register leaderboard games ─────────
-- One row per game that has leaderboard support. id must equal leaderboard.gameId in script.js.
-- max_score is the highest score you consider plausible; the Edge Function rejects anything above it.
-- Example (edit and run when you connect a game):
-- insert into public.games (id, title, min_score, max_score) values ('my-game', 'My Game', 0, 1000000)
--   on conflict (id) do update set title = excluded.title, max_score = excluded.max_score;
