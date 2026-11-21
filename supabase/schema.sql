-- Airport Code Trainer · world leaderboard (tables are prefixed act_ so they never clash with other apps in the same project)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it replaces the functions and keeps your data. Every function keeps the name and inputs
-- older copies of the site use, so the site and the database can be updated in either order.
--
-- How accounts work: a player is just a name. When a name is claimed,
-- the database makes a random 12-character account code and stores only
-- its hash. The browser keeps the code, so the player never types it
-- unless they sign in on another device or after signing out.
--
-- The tables have row level security on and no policies, so the public
-- (anon) key cannot read or write them directly. Everything goes through
-- the functions below, which check the name + code before writing.
--
-- Built to stay inside Supabase's free plan with a lot of players:
--   · a name's word-filter result is stored once (act_players.hidden), so boards never re-run the filter row by row
--   · new names and new rounds are rate-limited (per network and overall), so nobody can flood the database
--   · one cached call returns every board the home page shows (get_boards)
--   · old rounds, counters and read notices are cleaned up as the site is used; no extension needed
--
-- Hide a player from every board (and stop them posting):
--   update public.act_players set hidden = true where name_key = lower('TheirName');

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.act_players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  name_key    text generated always as (lower(name)) stored unique,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  last_submit timestamptz
);
alter table public.act_players add column if not exists hidden boolean not null default false;

create table if not exists public.act_scores (
  player_id  uuid not null references public.act_players(id) on delete cascade,
  game       text not null check (game in ('defender','tower')),
  level      text not null,
  score      integer not null check (score between 1 and 50000000),
  wave       integer not null default 1 check (wave between 1 and 1000),
  map        text not null default 'Wyoming',
  updated_at timestamptz not null default now(),
  primary key (player_id, game, level)
);
-- boards read in score order; the old index is replaced by one that also covers the tie-break
drop index if exists public.act_scores_board;
create index if not exists act_scores_board2 on public.act_scores (game, level, score desc, updated_at);

create table if not exists public.act_notices (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.act_players(id) on delete cascade,
  by_name     text not null,
  game        text not null,
  level       text not null,
  their_score integer not null,
  new_score   integer not null,
  new_rank    integer,
  dropped_off boolean not null default false,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists act_notices_player on public.act_notices (player_id, seen);
create index if not exists act_notices_open on public.act_notices (game, level) where new_rank is null;
-- one unread notice per player and board: a newer pass replaces the older one (older duplicates are marked read first)
update public.act_notices n set seen = true
 where not n.seen and exists (select 1 from public.act_notices m where not m.seen and m.player_id = n.player_id
                                and m.game = n.game and m.level = n.level and m.id > n.id);
create unique index if not exists act_notices_one_open on public.act_notices (player_id, game, level) where not seen;

-- one row per game started, so a posted score can be checked against how long the round really took
create table if not exists public.act_runs (
  id         uuid primary key default gen_random_uuid(),
  game       text not null,
  level      text not null,
  started_at timestamptz not null default now(),
  used       boolean not null default false
);
create index if not exists act_runs_age on public.act_runs (started_at);

-- rate-limit counters (key + time window) and the cached boards for get_boards
create table if not exists public.act_rl (
  k  text not null,
  w  bigint not null,
  n  integer not null default 0,
  at timestamptz not null default now(),
  primary key (k, w)
);
create table if not exists public.act_board_cache (
  k  text primary key,
  d  jsonb not null,
  at timestamptz not null default now()
);

alter table public.act_players     enable row level security;
alter table public.act_scores      enable row level security;
alter table public.act_notices     enable row level security;
alter table public.act_runs        enable row level security;
alter table public.act_rl          enable row level security;
alter table public.act_board_cache enable row level security;
revoke all on public.act_players, public.act_scores, public.act_notices, public.act_runs, public.act_rl, public.act_board_cache from anon, authenticated;

-- internal: check a name + account code, return the player id
create or replace function public._verify(p_name text, p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  select id into pid from act_players
   where name_key = lower(p_name)
     and code_hash = encode(digest(upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
  if pid is null then raise exception 'bad_login'; end if;
  return pid;
end $$;
revoke all on function public._verify(text, text) from public, anon, authenticated;

-- internal: is this name off-limits? Same rules as src/names.js. The word lists are ROT13'd
-- (translate() turns them back) so this file doesn't read like a list of swears.
create or replace function public._bad_name(p text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  r13 constant text := 'nopqrstuvwxyzabcdefghijklm';
  az  constant text := 'abcdefghijklmnopqrstuvwxyz';
  hard_words text[] := array['shpx','spx','cuhpx','fuvg','fu1g','ovgpu','ovngpu','phag','avttre','avttn','avtt','xvxr','puvax','tbbx','jrgonpx','ornare','snttbg','sntbg','genaal','ergneq','ergeq','juber','fyhg','cbea','chffl','cravf','intvan','qvyqb','obare','oybjwbo','unaqwbo','wvmm','phzfubg','encvfg','zbyrfg','anmv','uvgyre','xxx','wvunq','pbpxfhpx','zbgures','nffubyr','qvpxurnq','onfgneq','jnaxre','gjng','obyybpx','gvgf','gvggl','obbo','zvys','uragnv'];
  soft_words text[] := array['nff','nefr','phz','frk','qvpx','pbpx','gvg','ubr','wnc','fcvp','fcvpx','encr','crqb','fhvpvqr','snt','qlxr','avtn','shx','ubeal','nqzva','zbqrengbe','bssvpvny','naguebcvp'];
  allow_words text[] := array['matsushita','shiitake','shitake','therapist','scunthorpe','penistone'];
  low text := lower(coalesce(p, ''));
  tr text; flat text; sq text; w text; part text; parts text[];
begin
  -- 0→o 1→i 2→z 3→e 4→a 5→s 6→g 7→t 8→b 9→g
  tr := translate(low, '0123456789', 'oizeasgtbg');
  flat := replace(tr, '_', '');
  foreach w in array allow_words loop flat := replace(flat, w, ''); end loop;
  sq := regexp_replace(flat, '(.)\1+', '\1', 'g');
  foreach w in array hard_words loop
    w := translate(w, az, r13);
    if position(w in flat) > 0 then return true; end if;
    -- stretched spellings (fuuuck), only for words with no double letters of their own
    if regexp_replace(w, '(.)\1+', '\1', 'g') = w and position(w in sq) > 0 then return true; end if;
  end loop;
  parts := array[flat] || regexp_split_to_array(tr, '_+') || regexp_split_to_array(low, '[_0-9]+');
  foreach w in array soft_words loop
    w := translate(w, az, r13);
    foreach part in array parts loop
      if part <> '' and (part = w or (part ~ '(.)\1\1' and regexp_replace(part, '(.)\1+', '\1', 'g') = w)) then return true; end if;
    end loop;
  end loop;
  return false;
end $$;
revoke all on function public._bad_name(text) from public, anon, authenticated;

-- internal: the highest score a real game could reach by a given wave or shift.
-- Air Defender: every bomb (and its split half) shot at the top of the screen with a full combo, no hints.
-- Tower Control: every flight's legs flown on a full tank with a full combo, no hints. Real scores are far lower.
create or replace function public._max_score(p_game text, p_wave integer)
returns bigint language sql immutable set search_path = public as $$
  select 1000 + coalesce(sum(case when p_game = 'defender'
                                  then 1275::bigint * w * (4 + 2 * w) + 100 * w
                                  else 1200::bigint * w * (3 + 2 * w) + 125 * w end), 0)
    from generate_series(1, greatest(coalesce(p_wave, 1), 1)) w;
$$;
revoke all on function public._max_score(text, integer) from public, anon, authenticated;

-- names claimed before the word filter existed are hidden, once. After that the hidden flag is yours to change
-- by hand: running this file again won't hide a name you un-hid.
create table if not exists public.act_meta (k text primary key, at timestamptz not null default now());
alter table public.act_meta enable row level security;
revoke all on public.act_meta from anon, authenticated;
do $$
begin
  if not exists (select 1 from public.act_meta where k = 'hidden_backfill_v1') then
    update public.act_players set hidden = true where not hidden and public._bad_name(name);
    insert into public.act_meta (k) values ('hidden_backfill_v1');
  end if;
end $$;

-- internal: the least real time a round can take to reach a wave (Air Defender) or shift (Tower Control).
-- From the games' own pacing: wave w sends 4+2w bombs at least 0.8 s apart after a 3 s intro; shift s sends
-- 3+2s flights at least 1.6 s apart after a 3.6 s intro. Only 80% of that is required, so honest play always passes.
create or replace function public._min_secs(p_game text, p_wave integer)
returns numeric language sql immutable set search_path = public as $$
  select 0.8 * case when p_game = 'defender'
                    then 5.5 * (greatest(p_wave, 1) - 1) + 0.8 * greatest(p_wave, 1) * (greatest(p_wave, 1) - 1)
                    else 6.8 * (greatest(p_wave, 1) - 1) + 1.6 * greatest(p_wave, 1) * (greatest(p_wave, 1) - 1) end;
$$;
revoke all on function public._min_secs(text, integer) from public, anon, authenticated;

-- internal: where a score ranks on its board, counting only names that show on the board
create or replace function public._rank(p_game text, p_level text, p_score integer)
returns integer language sql stable set search_path = public as $$
  select (count(*) + 1)::int from act_scores s join act_players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level and s.score > p_score and not p.hidden;
$$;
revoke all on function public._rank(text, text, integer) from public, anon, authenticated;

-- internal: rate limit. Counts calls per key in a time window and stops with slow_down past p_max.
-- Per network (the caller's IP from the request headers) unless p_global; with no IP to go by, only global limits apply.
-- A whole class on one school network shares an IP, so the per-network limits are generous.
create or replace function public._rl(p_key text, p_max integer, p_secs integer, p_global boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare h json; ip text; c integer;
begin
  if p_global then
    ip := 'all';
  else
    begin
      h := nullif(current_setting('request.headers', true), '')::json;
    exception when others then h := null;
    end;
    ip := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''));
    if ip is null then return; end if;
  end if;
  insert into act_rl as r (k, w, n) values (p_key || ':' || ip, floor(extract(epoch from now()) / p_secs)::bigint, 1)
  on conflict (k, w) do update set n = r.n + 1
  returning n into c;
  if c > p_max then raise exception 'slow_down'; end if;
end $$;
revoke all on function public._rl(text, integer, integer, boolean) from public, anon, authenticated;

-- study progress saved to the account (levels, XP, streak, high scores, own codes), so it follows a player to any
-- computer or phone. One row per player. The site merges copies itself; v counts saves, so two devices saving at
-- the same time never overwrite each other: a save made from an older copy is refused and handed the newer one.
create table if not exists public.act_progress (
  player_id  uuid primary key references public.act_players(id) on delete cascade,
  data       jsonb not null,
  v          integer not null default 1,
  updated_at timestamptz not null default now()
);

-- errors the site hits in players' browsers: one row per distinct error, with a count. No names or codes are sent.
-- See them in Supabase → Table Editor → act_errors (newest last_at first).
create table if not exists public.act_errors (
  k        text primary key,
  msg      text not null,
  src      text not null default '',
  ua       text not null default '',
  build    text not null default '',
  n        integer not null default 1,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now()
);

alter table public.act_progress enable row level security;
alter table public.act_errors   enable row level security;
revoke all on public.act_progress, public.act_errors from anon, authenticated;

-- internal: housekeeping, run now and then by start_run so nothing piles up
create or replace function public._cleanup()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from act_runs where started_at < now() - interval '1 day';
  delete from act_rl where at < now() - interval '2 hours';
  delete from act_board_cache where at < now() - interval '1 hour';
  delete from act_notices where (seen and created_at < now() - interval '14 days') or created_at < now() - interval '90 days';
  delete from act_errors where last_at < now() - interval '60 days';
end $$;
revoke all on function public._cleanup() from public, anon, authenticated;

-- a game is starting: hand back a round id. A score can only be posted once per round, and only
-- if enough real time has passed for the wave or shift it claims (see _min_secs).
create or replace function public.start_run(p_game text, p_level text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare rid uuid;
begin
  if not ((p_game = 'defender' and p_level in ('cadet','pilot','ace'))
       or (p_game = 'tower'    and p_level in ('trainee','controller','chief'))) then
    raise exception 'bad_board';
  end if;
  perform _rl('run', 150, 60);                 -- per network: 150 rounds a minute
  perform _rl('run_all', 40000, 3600, true);   -- everyone together: 40,000 an hour
  if random() < 0.02 then perform _cleanup(); end if;
  insert into act_runs (game, level) values (p_game, p_level) returning id into rid;
  return rid;
end $$;

-- claim a brand-new name; returns {name, code}
create or replace function public.claim_name(p_name text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 characters, no 0/O or 1/I
  b bytea := gen_random_bytes(12);
  c text := '';
  i int;
begin
  if p_name is null or p_name !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'bad_name'; end if;
  if _bad_name(p_name) then raise exception 'name_blocked'; end if;
  if exists (select 1 from act_players where name_key = lower(p_name)) then raise exception 'name_taken'; end if;
  perform _rl('claim', 60, 600);               -- per network: 60 new names in 10 minutes
  perform _rl('claim_all', 3000, 3600, true);  -- everyone together: 3,000 an hour
  for i in 0..11 loop c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
  insert into act_players (name, code_hash) values (p_name, encode(digest(c, 'sha256'), 'hex'));
  return json_build_object('name', p_name, 'code', c);
exception when unique_violation then raise exception 'name_taken';
end $$;

-- sign in to an existing name with its account code; returns {name}
create or replace function public.sign_in(p_name text, p_code text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; n text;
begin
  pid := _verify(p_name, p_code);
  select name into n from act_players where id = pid;
  return json_build_object('name', n);
end $$;

-- post a score; keeps each player's best per board and tells the people it passes
drop function if exists public.submit_score(text, text, text, text, integer, integer, text);
create or replace function public.submit_score(p_name text, p_code text, p_game text, p_level text,
                                               p_score integer, p_wave integer, p_map text, p_run uuid default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; pname text; phidden boolean; prev_submit timestamptz; old_best int; thr int; r record; run act_runs%rowtype; v_map text;
begin
  pid := _verify(p_name, p_code);
  if not ((p_game = 'defender' and p_level in ('cadet','pilot','ace'))
       or (p_game = 'tower'    and p_level in ('trainee','controller','chief'))) then
    raise exception 'bad_board';
  end if;
  if p_score is null or p_score < 1 or p_score > 50000000 or p_wave is null or p_wave < 1 or p_wave > 1000
     or p_score > _max_score(p_game, p_wave) then
    raise exception 'bad_score';
  end if;

  -- the round: real, for this board, not posted yet, not stale, and long enough for the wave it reached
  select * into run from act_runs where id = p_run for update;
  if not found or run.used or run.game <> p_game or run.level <> p_level or run.started_at < now() - interval '6 hours' then
    raise exception 'bad_run';
  end if;
  if extract(epoch from (now() - run.started_at)) < _min_secs(p_game, p_wave) then raise exception 'bad_score'; end if;
  update act_runs set used = true where id = p_run;

  -- the map name shows on every board, so only the app's own map names get through
  v_map := trim(coalesce(p_map, ''));
  if not (v_map = any (array[
      '50 Busiest Airports','Arizona','New Mexico','Oklahoma','Texas','California','Colorado','Hawaii & Idaho','Montana & Nevada',
      'Oregon & Utah','Washington','Wyoming','Alaska','Alabama & Arkansas','Florida','Georgia, Kentucky & Louisiana',
      'Mississippi & North Carolina','South Carolina, Tennessee & West Virginia','Virginia & DC','CT, DE, DC, ME, MD & MA',
      'NH, NJ, RI & VT','New York','Pennsylvania','Illinois & Indiana','Iowa & Kansas','Michigan','Minnesota & Missouri',
      'Nebraska & North Dakota','Ohio & South Dakota','Wisconsin','Northwest & Rockies','California & Nevada',
      'Southwest & Texas','Midwest','Southeast','Northeast','My Codes'])) then
    v_map := 'Custom';
  end if;

  select name, hidden, last_submit into pname, phidden, prev_submit from act_players where id = pid for update;
  if phidden then raise exception 'name_blocked'; end if;
  if prev_submit is not null and prev_submit > now() - interval '3 seconds' then raise exception 'slow_down'; end if;
  update act_players set last_submit = now() where id = pid;

  select s.score into old_best from act_scores s where s.player_id = pid and s.game = p_game and s.level = p_level;
  if old_best is not null and p_score <= old_best then
    return json_build_object('improved', false, 'best', old_best, 'rank', _rank(p_game, p_level, old_best));
  end if;

  -- everyone in the top 10 who was at or above this player's old best and is now passed.
  -- thr = the 10th best score among everyone else: a score is in the top 10 exactly when it's at least thr.
  select s.score into thr from act_scores s join act_players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level and s.player_id <> pid and not p.hidden
   order by s.score desc offset 9 limit 1;
  for r in
    select s.player_id, s.score from act_scores s join act_players p on p.id = s.player_id
     where s.game = p_game and s.level = p_level and s.player_id <> pid and not p.hidden
       and s.score < p_score and s.score >= greatest(coalesce(old_best, 0), coalesce(thr, 0))
  loop
    insert into act_notices (player_id, by_name, game, level, their_score, new_score)
    values (r.player_id, pname, p_game, p_level, r.score, p_score)
    on conflict (player_id, game, level) where not seen
    do update set by_name = excluded.by_name, their_score = excluded.their_score, new_score = excluded.new_score,
                  new_rank = null, dropped_off = false, created_at = now();
  end loop;

  insert into act_scores (player_id, game, level, score, wave, map, updated_at)
  values (pid, p_game, p_level, p_score, p_wave, v_map, now())
  on conflict (player_id, game, level)
  do update set score = excluded.score, wave = excluded.wave, map = excluded.map, updated_at = now();

  update act_notices n
     set new_rank = q.rk, dropped_off = q.rk > 10
    from (select n2.id, _rank(n2.game, n2.level, n2.their_score) as rk
            from act_notices n2 where n2.new_rank is null and n2.game = p_game and n2.level = p_level) q
   where n.id = q.id;

  -- the cached copy of this board is stale now
  delete from act_board_cache where k = p_game || '/' || p_level;

  return json_build_object('improved', true, 'best', p_score, 'rank', _rank(p_game, p_level, p_score), 'previous', old_best);
end $$;

-- public leaderboard for one game + level. Equal scores share a rank (the earlier one is listed first),
-- the same way every other rank in the app is counted.
create or replace function public.get_leaderboard(p_game text, p_level text, p_limit integer default 25)
returns table (rank bigint, name text, score integer, wave integer, map text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select rank() over (order by s.score desc), p.name, s.score, s.wave, s.map, s.updated_at
    from act_scores s join act_players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level and not p.hidden
   order by s.score desc, s.updated_at asc
   limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

-- several boards at once, e.g. {'defender/cadet','tower/trainee'} for the home page. Each board is cached for
-- 15 seconds, so a classroom of open tabs costs the database one query per board, not one per tab.
create or replace function public.get_boards(p_keys text[] default array['defender/cadet','tower/trainee'])
returns jsonb language plpgsql security definer set search_path = public as $$
declare key text; g text; l text; c act_board_cache%rowtype; d jsonb; o jsonb := '{}';
begin
  foreach key in array coalesce(p_keys[1:6], array[]::text[]) loop
    g := split_part(key, '/', 1); l := split_part(key, '/', 2);
    continue when not ((g = 'defender' and l in ('cadet','pilot','ace')) or (g = 'tower' and l in ('trainee','controller','chief')));
    select * into c from act_board_cache b where b.k = key;
    if not found or c.at < now() - interval '15 seconds' then
      select coalesce(jsonb_agg(to_jsonb(t) order by t.rank), '[]'::jsonb) into d from get_leaderboard(g, l, 5) t;
      insert into act_board_cache (k, d, at) values (key, d, now())
      on conflict (k) do update set d = excluded.d, at = excluded.at;
    else
      d := c.d;
    end if;
    o := o || jsonb_build_object(key, d);
  end loop;
  return o;
end $$;

-- unseen "someone passed you" notices
create or replace function public.my_notices(p_name text, p_code text)
returns table (id bigint, by_name text, game text, level text, their_score integer, new_score integer,
               new_rank integer, dropped_off boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare pid uuid;
begin
  pid := _verify(p_name, p_code);
  return query
    select n.id, n.by_name, n.game, n.level, n.their_score, n.new_score, n.new_rank, n.dropped_off, n.created_at
      from act_notices n
     where n.player_id = pid and not n.seen
       and not exists (select 1 from act_players p where p.name_key = lower(n.by_name) and p.hidden)
     order by n.created_at desc limit 20;
end $$;

create or replace function public.dismiss_notices(p_name text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  pid := _verify(p_name, p_code);
  update act_notices set seen = true where player_id = pid and not seen;
end $$;

-- this player's bests with their current rank
create or replace function public.my_scores(p_name text, p_code text)
returns table (game text, level text, score integer, wave integer, rank bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare pid uuid;
begin
  pid := _verify(p_name, p_code);
  return query
    select s.game, s.level, s.score, s.wave,
           _rank(s.game, s.level, s.score)::bigint
      from act_scores s where s.player_id = pid order by s.game, s.level;
end $$;

-- this player's saved progress. p_v is the version the browser already has: when it's still the newest, only
-- {v} comes back (no data to download again). {v: 0} means nothing is saved yet.
create or replace function public.load_progress(p_name text, p_code text, p_v integer default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; r act_progress%rowtype;
begin
  pid := _verify(p_name, p_code);
  perform _rl('pl:' || pid::text, 30, 60, true);   -- per player: 30 loads a minute
  select * into r from act_progress where player_id = pid;
  if not found then return json_build_object('v', 0); end if;
  if p_v is not null and p_v = r.v then return json_build_object('v', r.v); end if;
  return json_build_object('v', r.v, 'data', r.data);
end $$;

-- save progress. p_v is the version this copy was made from (0 when there was none). Returns {ok: true, v}, or
-- {ok: false, v, data} when another device saved first: the browser merges that copy in and saves again.
-- Each copy is capped at 64 KB (a player who studied every code is about 20 KB). New copies stop when the table
-- reaches 150 MB, so the free plan's 500 MB can never fill up; players who already have one can still save.
create or replace function public.save_progress(p_name text, p_code text, p_data jsonb, p_v integer)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; r act_progress%rowtype;
begin
  pid := _verify(p_name, p_code);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 65536 then raise exception 'too_big'; end if;
  perform _rl('ps:' || pid::text, 20, 60, true);   -- per player: 20 saves a minute (the site saves about once a minute)
  perform _rl('ps_all', 100000, 3600, true);       -- everyone together: 100,000 an hour
  select * into r from act_progress where player_id = pid for update;
  if not found then
    if pg_total_relation_size('public.act_progress') > 150 * 1024 * 1024 then raise exception 'progress_full'; end if;
    perform _rl('ps_new', 3000, 3600, true);       -- first saves, everyone together: 3,000 an hour
    insert into act_progress (player_id, data) values (pid, p_data) on conflict (player_id) do nothing;
    if found then return json_build_object('ok', true, 'v', 1); end if;
    -- the same player's other device made the row a moment ago
    select * into r from act_progress where player_id = pid for update;
  end if;
  if p_v is null or p_v <> r.v then
    return json_build_object('ok', false, 'v', r.v, 'data', r.data);
  end if;
  update act_progress set data = p_data, v = r.v + 1, updated_at = now() where player_id = pid;
  return json_build_object('ok', true, 'v', r.v + 1);
end $$;

-- the site reports an error it hit (at most a few per visit). Same error again just counts up.
create or replace function public.log_error(p_msg text, p_src text default '', p_ua text default '', p_build text default '')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare m text := left(trim(coalesce(p_msg, '')), 300); s text := left(trim(coalesce(p_src, '')), 200); key text;
begin
  if m = '' then return; end if;
  perform _rl('err', 30, 600);                 -- per network: 30 reports in 10 minutes
  perform _rl('err_all', 2000, 3600, true);    -- everyone together: 2,000 an hour
  key := md5(m || '|' || s);
  -- at most 1,000 different errors are kept; a known one still counts up
  if not exists (select 1 from act_errors where k = key) and (select count(*) from act_errors) >= 1000 then return; end if;
  insert into act_errors as e (k, msg, src, ua, build)
  values (key, m, s, left(coalesce(p_ua, ''), 120), left(coalesce(p_build, ''), 40))
  on conflict (k) do update set n = e.n + 1, last_at = now(), ua = excluded.ua, build = excluded.build;
end $$;

grant execute on function public.claim_name(text)                                         to anon, authenticated;
grant execute on function public.sign_in(text, text)                                      to anon, authenticated;
grant execute on function public.start_run(text, text)                                   to anon, authenticated;
grant execute on function public.submit_score(text, text, text, text, integer, integer, text, uuid) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, integer)                     to anon, authenticated;
grant execute on function public.get_boards(text[])                                       to anon, authenticated;
grant execute on function public.my_notices(text, text)                                   to anon, authenticated;
grant execute on function public.dismiss_notices(text, text)                              to anon, authenticated;
grant execute on function public.my_scores(text, text)                                    to anon, authenticated;
grant execute on function public.load_progress(text, text, integer)                       to anon, authenticated;
grant execute on function public.save_progress(text, text, jsonb, integer)                to anon, authenticated;
grant execute on function public.log_error(text, text, text, text)                        to anon, authenticated;
