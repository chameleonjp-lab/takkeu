-- Prevent old generic ranking RPCs from re-exposing Takkeu anomalies.
-- Scope the new filter to Takkeu only; other games retain their prior behavior.
CREATE OR REPLACE FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone, metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ranked as (
    select
      row_number() over (
        order by
          case when g.score_order = 'asc' then gs.best_score end asc nulls last,
          case when coalesce(g.score_order, 'desc') <> 'asc' then gs.best_score end desc nulls last,
          gs.best_score_at asc
      )::integer as rank_no,
      p.display_name,
      gs.normalized_name,
      gs.game_slug,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    join public.players p
      on p.normalized_name = gs.normalized_name
    join public.games g
      on g.game_slug = gs.game_slug
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
      and p_game_slug not in ('sabasaba_normal', 'sabasaba_endless')
    order by
      case when g.score_order = 'asc' then gs.best_score end asc nulls last,
      case when coalesce(g.score_order, 'desc') <> 'asc' then gs.best_score end desc nulls last,
      gs.best_score_at asc
    limit p_limit
  )
  select
    r.rank_no,
    r.display_name,
    r.best_score,
    r.play_count,
    r.best_score_at,
    sr.metadata
  from ranked r
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = r.normalized_name
      and s.game_slug = r.game_slug
      and s.score = r.best_score
    order by
      abs(extract(epoch from (s.created_at - r.best_score_at))) asc,
      s.created_at desc,
      s.id desc
    limit 1
  ) sr on true
  order by r.rank_no;
$function$
;

CREATE OR REPLACE FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_no integer, display_name text, first_score integer, play_count integer, first_score_at timestamp with time zone, metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ranked as (
    select
      row_number() over (
        order by
          case when g.score_order = 'asc' then gs.first_score end asc nulls last,
          case when coalesce(g.score_order, 'desc') <> 'asc' then gs.first_score end desc nulls last,
          gs.first_score_at asc
      )::integer as rank_no,
      p.display_name,
      gs.normalized_name,
      gs.game_slug,
      gs.first_score,
      gs.play_count,
      gs.first_score_at
    from public.game_scores gs
    join public.players p
      on p.normalized_name = gs.normalized_name
    join public.games g
      on g.game_slug = gs.game_slug
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by
      case when g.score_order = 'asc' then gs.first_score end asc nulls last,
      case when coalesce(g.score_order, 'desc') <> 'asc' then gs.first_score end desc nulls last,
      gs.first_score_at asc
    limit p_limit
  )
  select
    r.rank_no,
    r.display_name,
    r.first_score,
    r.play_count,
    r.first_score_at,
    sr.metadata
  from ranked r
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = r.normalized_name
      and s.game_slug = r.game_slug
      and s.score = r.first_score
    order by
      abs(extract(epoch from (s.created_at - r.first_score_at))) asc,
      s.created_at asc,
      s.id asc
    limit 1
  ) sr on true
  order by r.rank_no;
$function$
;

CREATE OR REPLACE FUNCTION public.get_game_ranking(p_game_slug text, p_limit integer DEFAULT 100)
 RETURNS TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_score_order text;
  v_limit integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 100), 1), 100);

  select g.score_order
  into v_score_order
  from public.games g
  where g.game_slug = p_game_slug
    and g.is_active = true;

  if v_score_order is null then
    raise exception 'game not found';
  end if;

  if v_score_order = 'asc' then
    return query
    select
      row_number() over (
        order by gs.best_score asc, gs.best_score_at asc, gs.updated_at asc
      )::integer as rank_no,
      gs.display_name,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by gs.best_score asc, gs.best_score_at asc, gs.updated_at asc
    limit v_limit;
  else
    return query
    select
      row_number() over (
        order by gs.best_score desc, gs.best_score_at asc, gs.updated_at asc
      )::integer as rank_no,
      gs.display_name,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by gs.best_score desc, gs.best_score_at asc, gs.updated_at asc
    limit v_limit;
  end if;
end;
$function$
;
