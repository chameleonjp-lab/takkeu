-- Takkeu moderation. Applied to the shared Supabase project on 2026-10-27.
-- Preserve original scores and other games; only the two inspected Takkeu records are classified.
alter table public.game_scores drop constraint if exists game_scores_ranking_status_check;
alter table public.game_scores add constraint game_scores_ranking_status_check
  check (ranking_status in ('normal','review','hidden','disqualified','provisional_bot','bot'));

create table if not exists private.takkeu_moderation_audit_v1 (
  id bigint generated always as identity primary key,
  normalized_name text not null,
  previous_status text not null,
  new_status text not null,
  previous_note text,
  new_note text,
  previous_best_score integer not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table private.takkeu_moderation_audit_v1 enable row level security;
revoke all on table private.takkeu_moderation_audit_v1 from public, anon, authenticated;

insert into private.takkeu_moderation_audit_v1
  (normalized_name, previous_status, new_status, previous_note, new_note, previous_best_score)
select normalized_name, ranking_status, 'provisional_bot', ranking_note,
  'スコアとプレイ時間の整合性に疑義があるため暫定BOT。自動操作は未確定。', best_score
from public.game_scores
where game_slug = 'takkeu' and ranking_status = 'normal'
  and ((normalized_name = '💩' and best_score = 45773300)
    or (normalized_name = 'あ' and best_score = 7927));

update public.game_scores
set ranking_status = 'provisional_bot',
    ranking_note = 'スコアとプレイ時間の整合性に疑義があるため暫定BOT。自動操作は未確定。',
    ranking_status_updated_at = pg_catalog.clock_timestamp()
where game_slug = 'takkeu' and ranking_status = 'normal'
  and ((normalized_name = '💩' and best_score = 45773300)
    or (normalized_name = 'あ' and best_score = 7927));

-- Non-sensitive, game-scoped public view of moved records.
create or replace function public.get_takkeu_abnormal_entries_v1(p_limit integer default 50)
returns table (
  display_name text, first_score integer, best_score integer, play_count integer,
  ranking_status text, ranking_note text, ranking_status_updated_at timestamptz
)
language sql stable security definer
set search_path = ''
as $function$
  select gs.display_name, gs.first_score, gs.best_score, gs.play_count,
    gs.ranking_status, gs.ranking_note, gs.ranking_status_updated_at
  from public.game_scores as gs
  where gs.game_slug = 'takkeu'
    and gs.ranking_status in ('provisional_bot','bot','disqualified')
  order by gs.best_score desc, gs.ranking_status_updated_at asc nulls last, gs.display_name asc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$function$;
revoke all on function public.get_takkeu_abnormal_entries_v1(integer) from public;
grant execute on function public.get_takkeu_abnormal_entries_v1(integer) to anon, authenticated, service_role;
comment on function public.get_takkeu_abnormal_entries_v1(integer) is
  'Takkeu-only abnormal records. Provisional BOT does not assert automated play. No private session data.';

-- The shared public get_best_score_ranking/get_first_try_ranking and player-position RPCs
-- already exclude every status other than normal. Other games are unchanged.
