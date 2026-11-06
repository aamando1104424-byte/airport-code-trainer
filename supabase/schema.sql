-- Airport Code Trainer · world leaderboard (tables are prefixed act_ so they never clash with other apps in the same project)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it replaces the functions and keeps your data.
-- Running the newest copy also turns on the name filter and the score sanity check.
--
-- How accounts work: a player is just a name. When a name is claimed,
-- the database makes a random 12-character account code and stores only
-- its hash. The browser keeps the code, so the player never types it
-- unless they sign in on another device or after signing out.
--
-- The tables have row level security on and no policies, so the public
-- (anon) key cannot read or write them directly. Everything goes through
-- the functions below, which check the name + code before writing.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.act_players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  name_key    text generated always as (lower(name)) stored unique,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  last_submit timestamptz
);

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
create index if not exists act_scores_board on public.act_scores (game, level, score desc);

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

-- one row per game started, so a posted score can be checked against how long the round really took
create table if not exists public.act_runs (
  id         uuid primary key default gen_random_uuid(),
  game       text not null,
  level      text not null,
  started_at timestamptz not null default now(),
  used       boolean not null default false
);
create index if not exists act_runs_age on public.act_runs (started_at);

alter table public.act_players enable row level security;
alter table public.act_scores  enable row level security;
alter table public.act_notices enable row level security;
alter table public.act_runs    enable row level security;
revoke all on public.act_players, public.act_scores, public.act_notices, public.act_runs from anon, authenticated;

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

-- internal: where a score ranks on its board, counting only names that show on the board
create or replace function public._rank(p_game text, p_level text, p_score integer)
returns integer language sql stable set search_path = public as $$
  select (count(*) + 1)::int from act_scores s join act_players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level and s.score > p_score and not _bad_name(p.name);
$$;
revoke all on function public._rank(text, text, integer) from public, anon, authenticated;

-- a game is starting: hand back a round id. A score can only be posted once per round, and only
-- if enough real time has passed for the wave or shift it claims (every wave takes at least 5 seconds).
create or replace function public.start_run(p_game text, p_level text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare rid uuid;
begin
  if not ((p_game = 'defender' and p_level in ('cadet','pilot','ace'))
       or (p_game = 'tower'    and p_level in ('trainee','controller','chief'))) then
    raise exception 'bad_board';
  end if;
  delete from act_runs where started_at < now() - interval '1 day';
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
declare pid uuid; pname text; prev_submit timestamptz; old_best int; my_rank int; r record; run act_runs%rowtype; v_map text;
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
  if now() - run.started_at < make_interval(secs => 5 * (p_wave - 1)) then raise exception 'bad_score'; end if;
  update act_runs set used = true where id = p_run;

  -- the map name is shown on every board, so only plain set names get through
  v_map := left(coalesce(nullif(trim(p_map), ''), 'Wyoming'), 40);
  if v_map !~ '^[A-Za-z0-9 &,.''()/-]+$' or _bad_name(regexp_replace(v_map, '[^A-Za-z0-9]+', '_', 'g')) then v_map := 'Custom'; end if;

  select name, last_submit into pname, prev_submit from act_players where id = pid for update;
  if _bad_name(pname) then raise exception 'name_blocked'; end if;
  if prev_submit is not null and prev_submit > now() - interval '3 seconds' then raise exception 'slow_down'; end if;
  update act_players set last_submit = now() where id = pid;

  select s.score into old_best from act_scores s where s.player_id = pid and s.game = p_game and s.level = p_level;
  if old_best is not null and p_score <= old_best then
    return json_build_object('improved', false, 'best', old_best, 'rank', _rank(p_game, p_level, old_best));
  end if;

  -- everyone in the top 10 who was at or above this player's old best and is now passed
  for r in
    with top as (
      select s.player_id, s.score, rank() over (order by s.score desc) as rk
        from act_scores s join act_players p on p.id = s.player_id
       where s.game = p_game and s.level = p_level and s.player_id <> pid and not _bad_name(p.name))
    select t.player_id, t.score from top t
     where t.rk <= 10 and t.score < p_score and t.score >= coalesce(old_best, 0)
  loop
    insert into act_notices (player_id, by_name, game, level, their_score, new_score)
    values (r.player_id, pname, p_game, p_level, r.score, p_score);
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

  return json_build_object('improved', true, 'best', p_score, 'rank', _rank(p_game, p_level, p_score), 'previous', old_best);
end $$;

-- public leaderboard for one game + level
create or replace function public.get_leaderboard(p_game text, p_level text, p_limit integer default 25)
returns table (rank bigint, name text, score integer, wave integer, map text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select rank() over (order by s.score desc, s.updated_at asc), p.name, s.score, s.wave, s.map, s.updated_at
    from act_scores s join act_players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level and not _bad_name(p.name)
   order by s.score desc, s.updated_at asc
   limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- unseen "someone beat you" act_notices
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
      from act_notices n where n.player_id = pid and not n.seen and not _bad_name(n.by_name)
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

grant execute on function public.claim_name(text)                                         to anon, authenticated;
grant execute on function public.sign_in(text, text)                                      to anon, authenticated;
grant execute on function public.start_run(text, text)                                   to anon, authenticated;
grant execute on function public.submit_score(text, text, text, text, integer, integer, text, uuid) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, integer)                     to anon, authenticated;
grant execute on function public.my_notices(text, text)                                   to anon, authenticated;
grant execute on function public.dismiss_notices(text, text)                              to anon, authenticated;
grant execute on function public.my_scores(text, text)                                    to anon, authenticated;
