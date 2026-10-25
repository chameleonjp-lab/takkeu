-- Additive public leaderboard aggregate. Do not change existing ranking RPCs.
-- Eligibility and competition ties match get_best_score_ranking(takkeu).
-- SECURITY DEFINER is necessary: anon has no SELECT on game_scores (RLS).
-- Only this game's public rank/count/best are exposed, never names or runs.
create function public.get_takkeu_player_position_v1(p_normalized_name text)
returns table (rank_no bigint, total_entries bigint, best_score integer)
language sql stable security definer
set search_path = ''
as $function$
  with eligible as materialized (
    select gs.normalized_name, gs.best_score
    from public.game_scores as gs
    where gs.game_slug = 'takkeu'
      and gs.first_score is not null
      and coalesce(gs.ranking_status, 'normal') = 'normal'
  ), mine as (
    select e.best_score
    from eligible as e
    where e.normalized_name = public.normalize_player_name(p_normalized_name)
  )
  select 1 + count(*) filter (where e.best_score > mine.best_score),
         count(*), mine.best_score
  from eligible as e cross join mine
  group by mine.best_score;
$function$;

revoke all on function public.get_takkeu_player_position_v1(text) from public;
grant execute on function public.get_takkeu_player_position_v1(text) to anon, authenticated, service_role;
comment on function public.get_takkeu_player_position_v1(text) is
  'Takkeu public best-score position among eligible registered names; competition ties, no top-N limit. Empty if ineligible.';
