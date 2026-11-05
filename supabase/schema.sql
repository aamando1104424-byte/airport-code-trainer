-- Wyoming Airport Codes · world leaderboard
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it replaces the functions and keeps your data.
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

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  name_key    text generated always as (lower(name)) stored unique,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  last_submit timestamptz
);

create table if not exists public.scores (
  player_id  uuid not null references public.players(id) on delete cascade,
  game       text not null check (game in ('defender','tower')),
  level      text not null,
  score      integer not null check (score between 1 and 50000000),
  wave       integer not null default 1 check (wave between 1 and 1000),
  map        text not null default 'Wyoming',
  updated_at timestamptz not null default now(),
  primary key (player_id, game, level)
);
create index if not exists scores_board on public.scores (game, level, score desc);

create table if not exists public.notices (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
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
create index if not exists notices_player on public.notices (player_id, seen);

alter table public.players enable row level security;
alter table public.scores  enable row level security;
alter table public.notices enable row level security;
revoke all on public.players, public.scores, public.notices from anon, authenticated;

-- internal: check a name + account code, return the player id
create or replace function public._verify(p_name text, p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  select id into pid from players
   where name_key = lower(p_name)
     and code_hash = encode(digest(upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
  if pid is null then raise exception 'bad_login'; end if;
  return pid;
end $$;
revoke all on function public._verify(text, text) from public, anon, authenticated;

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
  if exists (select 1 from players where name_key = lower(p_name)) then raise exception 'name_taken'; end if;
  for i in 0..11 loop c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
  insert into players (name, code_hash) values (p_name, encode(digest(c, 'sha256'), 'hex'));
  return json_build_object('name', p_name, 'code', c);
exception when unique_violation then raise exception 'name_taken';
end $$;

-- sign in to an existing name with its account code; returns {name}
create or replace function public.sign_in(p_name text, p_code text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; n text;
begin
  pid := _verify(p_name, p_code);
  select name into n from players where id = pid;
  return json_build_object('name', n);
end $$;

-- post a score; keeps each player's best per board and tells the people it passes
create or replace function public.submit_score(p_name text, p_code text, p_game text, p_level text,
                                               p_score integer, p_wave integer, p_map text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; pname text; prev_submit timestamptz; old_best int; my_rank int; r record;
begin
  pid := _verify(p_name, p_code);
  if not ((p_game = 'defender' and p_level in ('cadet','pilot','ace'))
       or (p_game = 'tower'    and p_level in ('trainee','controller','chief'))) then
    raise exception 'bad_board';
  end if;
  if p_score is null or p_score < 1 or p_score > 50000000 or p_wave is null or p_wave < 1 or p_wave > 1000 then
    raise exception 'bad_score';
  end if;

  select name, last_submit into pname, prev_submit from players where id = pid for update;
  if prev_submit is not null and prev_submit > now() - interval '3 seconds' then raise exception 'slow_down'; end if;
  update players set last_submit = now() where id = pid;

  select s.score into old_best from scores s where s.player_id = pid and s.game = p_game and s.level = p_level;
  if old_best is not null and p_score <= old_best then
    select count(*) + 1 into my_rank from scores s where s.game = p_game and s.level = p_level and s.score > old_best;
    return json_build_object('improved', false, 'best', old_best, 'rank', my_rank);
  end if;

  -- everyone in the top 10 who was at or above this player's old best and is now passed
  for r in
    with top as (
      select s.player_id, s.score, rank() over (order by s.score desc) as rk
        from scores s where s.game = p_game and s.level = p_level and s.player_id <> pid)
    select t.player_id, t.score from top t
     where t.rk <= 10 and t.score < p_score and t.score >= coalesce(old_best, 0)
  loop
    insert into notices (player_id, by_name, game, level, their_score, new_score)
    values (r.player_id, pname, p_game, p_level, r.score, p_score);
  end loop;

  insert into scores (player_id, game, level, score, wave, map, updated_at)
  values (pid, p_game, p_level, p_score, p_wave, left(coalesce(nullif(p_map, ''), 'Wyoming'), 40), now())
  on conflict (player_id, game, level)
  do update set score = excluded.score, wave = excluded.wave, map = excluded.map, updated_at = now();

  update notices n
     set new_rank = q.rk, dropped_off = q.rk > 10
    from (select n2.id, (select count(*) + 1 from scores s
                          where s.game = n2.game and s.level = n2.level and s.score > n2.their_score) as rk
            from notices n2 where n2.new_rank is null and n2.game = p_game and n2.level = p_level) q
   where n.id = q.id;

  select count(*) + 1 into my_rank from scores s where s.game = p_game and s.level = p_level and s.score > p_score;
  return json_build_object('improved', true, 'best', p_score, 'rank', my_rank, 'previous', old_best);
end $$;

-- public leaderboard for one game + level
create or replace function public.get_leaderboard(p_game text, p_level text, p_limit integer default 25)
returns table (rank bigint, name text, score integer, wave integer, map text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select rank() over (order by s.score desc, s.updated_at asc), p.name, s.score, s.wave, s.map, s.updated_at
    from scores s join players p on p.id = s.player_id
   where s.game = p_game and s.level = p_level
   order by s.score desc, s.updated_at asc
   limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- unseen "someone beat you" notices
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
      from notices n where n.player_id = pid and not n.seen
     order by n.created_at desc limit 20;
end $$;

create or replace function public.dismiss_notices(p_name text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  pid := _verify(p_name, p_code);
  update notices set seen = true where player_id = pid and not seen;
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
           (select count(*) + 1 from scores t where t.game = s.game and t.level = s.level and t.score > s.score)
      from scores s where s.player_id = pid order by s.game, s.level;
end $$;

grant execute on function public.claim_name(text)                                         to anon, authenticated;
grant execute on function public.sign_in(text, text)                                      to anon, authenticated;
grant execute on function public.submit_score(text, text, text, text, integer, integer, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, integer)                     to anon, authenticated;
grant execute on function public.my_notices(text, text)                                   to anon, authenticated;
grant execute on function public.dismiss_notices(text, text)                              to anon, authenticated;
grant execute on function public.my_scores(text, text)                                    to anon, authenticated;
