-- OFFLINE ONLY: disposable schema replica, no player/session/score data.
-- Catalog observed 2026-10-28T00:08:50.792218+00:00; functions from production read-only snapshot.
-- This fixture is not an application or rollback script.
CREATE SCHEMA private;
CREATE SCHEMA supabase_migrations;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE ROLE release_reader LOGIN;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
CREATE TABLE "public"."games" ("game_slug" text NOT NULL,
"title" text NOT NULL,
"game_url" text NOT NULL,
"description" text DEFAULT ''::text,
"share_text" text DEFAULT ''::text,
"score_order" text NOT NULL DEFAULT 'desc'::text,
"score_unit" text NOT NULL DEFAULT '点'::text,
"is_active" boolean NOT NULL DEFAULT true,
"release_date" date DEFAULT CURRENT_DATE,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"score_scale" integer NOT NULL DEFAULT 1,
"score_decimals" integer NOT NULL DEFAULT 0,
"score_label" text,
"first_score_label" text,
"best_score_label" text,
"display_order" integer,
"top_ranking_type" text NOT NULL DEFAULT 'best'::text,
"submission_mode" text NOT NULL DEFAULT 'shared'::text,
"score_min" integer NOT NULL DEFAULT '-100000000'::integer,
"score_max" integer NOT NULL DEFAULT 100000000);
CREATE TABLE "private"."game_play_sessions" ("client_version" text NOT NULL DEFAULT ''::text,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"display_name" text NOT NULL,
"finished_at" timestamp with time zone,
"game_slug" text NOT NULL,
"normalized_name" text NOT NULL,
"play_id" uuid NOT NULL DEFAULT gen_random_uuid(),
"ranking_score" integer,
"reached_wave" integer NOT NULL DEFAULT 1,
"result_type" text NOT NULL DEFAULT 'retire'::text,
"score" integer NOT NULL DEFAULT 0,
"start_id" uuid,
"started_at" timestamp with time zone NOT NULL DEFAULT now(),
"submission_id" uuid,
"takkeu_final_lost_balls" integer,
"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE "public"."game_scores" ("best_clear_wave" integer NOT NULL DEFAULT 0,
"best_score" integer NOT NULL DEFAULT 0,
"best_score_at" timestamp with time zone,
"display_name" text NOT NULL,
"first_clear_wave" integer NOT NULL DEFAULT 0,
"first_score" integer,
"first_score_at" timestamp with time zone,
"game_slug" text NOT NULL,
"normalized_name" text NOT NULL,
"play_count" integer NOT NULL DEFAULT 0,
"ranking_note" text,
"ranking_status" text NOT NULL DEFAULT 'normal'::text,
"ranking_status_updated_at" timestamp with time zone,
"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE "public"."players" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),
"display_name" text NOT NULL,
"last_played_at" timestamp with time zone,
"normalized_name" text NOT NULL);
CREATE TABLE "public"."score_runs" ("clear_wave" integer NOT NULL DEFAULT 0,
"client_version" text DEFAULT ''::text,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"game_slug" text NOT NULL,
"id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
"normalized_name" text NOT NULL,
"play_id" uuid,
"score" integer NOT NULL,
"submission_id" uuid);
ALTER TABLE "public"."games" ADD CONSTRAINT "games_pkey" PRIMARY KEY (game_slug);
ALTER TABLE "public"."games" ADD CONSTRAINT "games_score_bounds_check" CHECK ((score_min <= score_max));
ALTER TABLE "public"."games" ADD CONSTRAINT "games_score_decimals_range" CHECK (((score_decimals >= 0) AND (score_decimals <= 3)));
ALTER TABLE "public"."games" ADD CONSTRAINT "games_score_order_check" CHECK ((score_order = ANY (ARRAY['desc'::text, 'asc'::text])));
ALTER TABLE "public"."games" ADD CONSTRAINT "games_score_scale_positive" CHECK ((score_scale >= 1));
ALTER TABLE "public"."games" ADD CONSTRAINT "games_submission_mode_check" CHECK ((submission_mode = ANY (ARRAY['shared'::text, 'verified'::text])));
ALTER TABLE "public"."games" ADD CONSTRAINT "games_top_ranking_type_check" CHECK ((top_ranking_type = ANY (ARRAY['first'::text, 'best'::text])));
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_pkey" PRIMARY KEY (play_id);
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_ranking_score_check" CHECK (((ranking_score IS NULL) OR (ranking_score >= 0)));
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_reached_wave_check" CHECK (((reached_wave >= 1) AND (reached_wave <= 30)));
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_result_type_check" CHECK ((result_type = ANY (ARRAY['play'::text, 'clear'::text, 'game_over'::text, 'retire'::text])));
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_score_check" CHECK ((score >= 0));
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_submission_id_key" UNIQUE (submission_id);
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "takkeu_final_lost_balls_range_v1" CHECK (((takkeu_final_lost_balls IS NULL) OR ((game_slug = 'takkeu'::text) AND ((takkeu_final_lost_balls >= 0) AND (takkeu_final_lost_balls <= 100)))));
ALTER TABLE "private"."game_play_sessions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS game_play_sessions_game_player_started_idx ON private.game_play_sessions USING btree (game_slug, normalized_name, started_at);
CREATE INDEX IF NOT EXISTS game_play_sessions_game_started_idx ON private.game_play_sessions USING btree (game_slug, started_at);
CREATE INDEX IF NOT EXISTS game_play_sessions_normalized_name_idx ON private.game_play_sessions USING btree (normalized_name);
CREATE UNIQUE INDEX IF NOT EXISTS game_play_sessions_pkey ON private.game_play_sessions USING btree (play_id);
CREATE UNIQUE INDEX IF NOT EXISTS game_play_sessions_start_id_key ON private.game_play_sessions USING btree (start_id) WHERE (start_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS game_play_sessions_submission_id_key ON private.game_play_sessions USING btree (submission_id);
ALTER TABLE "public"."game_scores" ADD CONSTRAINT "game_scores_pkey" PRIMARY KEY (normalized_name, game_slug);
ALTER TABLE "public"."game_scores" ADD CONSTRAINT "game_scores_ranking_status_check" CHECK ((ranking_status = ANY (ARRAY['normal'::text, 'review'::text, 'hidden'::text, 'disqualified'::text, 'provisional_bot'::text, 'bot'::text])));
ALTER TABLE "public"."game_scores" ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS game_scores_game_slug_ranking_status_idx ON public.game_scores USING btree (game_slug, ranking_status);
CREATE UNIQUE INDEX IF NOT EXISTS game_scores_pkey ON public.game_scores USING btree (normalized_name, game_slug);
CREATE INDEX IF NOT EXISTS idx_game_scores_game_first_score ON public.game_scores USING btree (game_slug, first_score DESC, first_score_at);
CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores USING btree (game_slug, best_score DESC, best_score_at);
ALTER TABLE "public"."players" ADD CONSTRAINT "players_pkey" PRIMARY KEY (normalized_name);
ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS players_pkey ON public.players USING btree (normalized_name);
ALTER TABLE "public"."score_runs" ADD CONSTRAINT "score_runs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."score_runs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_score_runs_game_created ON public.score_runs USING btree (game_slug, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS score_runs_pkey ON public.score_runs USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS score_runs_play_id_uidx ON public.score_runs USING btree (play_id) WHERE (play_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS score_runs_sabasaba_play_token_unique ON public.score_runs USING btree (((metadata ->> 'play_token'::text))) WHERE ((game_slug = ANY (ARRAY['sabasaba_normal'::text, 'sabasaba_endless'::text])) AND ((metadata ->> 'play_token'::text) IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS score_runs_submission_id_uidx ON public.score_runs USING btree (submission_id) WHERE (submission_id IS NOT NULL);
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_game_slug_fkey" FOREIGN KEY (game_slug) REFERENCES public.games(game_slug);
ALTER TABLE "private"."game_play_sessions" ADD CONSTRAINT "game_play_sessions_normalized_name_fkey" FOREIGN KEY (normalized_name) REFERENCES public.players(normalized_name);
ALTER TABLE "public"."game_scores" ADD CONSTRAINT "game_scores_game_slug_fkey" FOREIGN KEY (game_slug) REFERENCES public.games(game_slug) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."game_scores" ADD CONSTRAINT "game_scores_normalized_name_fkey" FOREIGN KEY (normalized_name) REFERENCES public.players(normalized_name) ON DELETE CASCADE;
ALTER TABLE "public"."score_runs" ADD CONSTRAINT "score_runs_play_id_fkey" FOREIGN KEY (play_id) REFERENCES private.game_play_sessions(play_id);
CREATE TABLE "private"."takkeu_guest_plays_v1" ("client_version" text NOT NULL,
"play_id" uuid NOT NULL DEFAULT gen_random_uuid(),
"start_id" uuid NOT NULL,
"started_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp());
ALTER TABLE "private"."takkeu_guest_plays_v1" ADD CONSTRAINT "takkeu_guest_plays_v1_client_version_check" CHECK (((char_length(client_version) >= 1) AND (char_length(client_version) <= 80)));
ALTER TABLE "private"."takkeu_guest_plays_v1" ADD CONSTRAINT "takkeu_guest_plays_v1_pkey" PRIMARY KEY (start_id);
ALTER TABLE "private"."takkeu_guest_plays_v1" ADD CONSTRAINT "takkeu_guest_plays_v1_play_id_key" UNIQUE (play_id);
CREATE UNIQUE INDEX IF NOT EXISTS takkeu_guest_plays_v1_pkey ON private.takkeu_guest_plays_v1 USING btree (start_id);
CREATE UNIQUE INDEX IF NOT EXISTS takkeu_guest_plays_v1_play_id_key ON private.takkeu_guest_plays_v1 USING btree (play_id);
CREATE INDEX IF NOT EXISTS takkeu_guest_plays_v1_started_at_idx ON private.takkeu_guest_plays_v1 USING btree (started_at);
ALTER TABLE "private"."takkeu_guest_plays_v1" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "private"."takkeu_progress_signals_v1" ("first_seen_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
"last_seen_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
"latest_score" integer NOT NULL,
"occurrence_count" integer NOT NULL DEFAULT 1,
"play_id" uuid NOT NULL,
"reason" text NOT NULL);
ALTER TABLE "private"."takkeu_progress_signals_v1" ADD CONSTRAINT "takkeu_progress_signal_reason_check" CHECK ((reason = ANY (ARRAY['invalid_rate'::text, 'high_density'::text, 'sim_time_invalid'::text, 'non_monotonic'::text])));
ALTER TABLE "private"."takkeu_progress_signals_v1" ADD CONSTRAINT "takkeu_progress_signals_v1_pkey" PRIMARY KEY (play_id, reason);
ALTER TABLE "private"."takkeu_progress_signals_v1" ADD CONSTRAINT "takkeu_progress_signals_v1_play_id_fkey" FOREIGN KEY (play_id) REFERENCES private.game_play_sessions(play_id);
CREATE UNIQUE INDEX IF NOT EXISTS takkeu_progress_signals_v1_pkey ON private.takkeu_progress_signals_v1 USING btree (play_id, reason);
ALTER TABLE "private"."takkeu_progress_signals_v1" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "private"."takkeu_progress_v1" ("first_report_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
"high_density_signal" boolean NOT NULL DEFAULT false,
"last_ball_count" integer NOT NULL,
"last_lost_balls" integer NOT NULL,
"last_report_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
"last_score" integer NOT NULL,
"last_sim_seconds" numeric(12,3) NOT NULL,
"play_id" uuid NOT NULL,
"report_count" integer NOT NULL DEFAULT 1);
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_last_ball_count_check" CHECK (((last_ball_count >= 0) AND (last_ball_count <= 30)));
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_last_lost_balls_check" CHECK (((last_lost_balls >= 0) AND (last_lost_balls <= 100)));
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_last_score_check" CHECK ((last_score >= 0));
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_last_sim_seconds_check" CHECK ((last_sim_seconds >= (0)::numeric));
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_pkey" PRIMARY KEY (play_id);
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_play_id_fkey" FOREIGN KEY (play_id) REFERENCES private.game_play_sessions(play_id);
ALTER TABLE "private"."takkeu_progress_v1" ADD CONSTRAINT "takkeu_progress_v1_report_count_check" CHECK ((report_count >= 1));
CREATE UNIQUE INDEX IF NOT EXISTS takkeu_progress_v1_pkey ON private.takkeu_progress_v1 USING btree (play_id);
ALTER TABLE "private"."takkeu_progress_v1" ENABLE ROW LEVEL SECURITY;
SET check_function_bodies=off;
CREATE FUNCTION "private"."attach_takkeu_final_losses_v1"() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_count integer;
begin
  if new.game_slug <> 'takkeu' or new.play_id is null then
    return new;
  end if;

  select s.takkeu_final_lost_balls into v_count
  from private.game_play_sessions as s
  where s.play_id = new.play_id
    and s.game_slug = 'takkeu'
    and s.finished_at is not null
    and s.score = new.score;

  if v_count is not null then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
                    || pg_catalog.jsonb_build_object('final_lost_balls', v_count);
  end if;

  return new;
end;
$snapshot$;
REVOKE ALL ON FUNCTION "private"."attach_takkeu_final_losses_v1"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "private"."attach_takkeu_final_losses_v1"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."attach_takkeu_final_losses_v1"() TO "anon";
GRANT EXECUTE ON FUNCTION "private"."attach_takkeu_final_losses_v1"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "private"."attach_takkeu_final_losses_v1"() TO "service_role";
CREATE FUNCTION "private"."guard_sabasaba_score_runs"() RETURNS trigger LANGUAGE plpgsql VOLATILE SET search_path='' AS $snapshot$
begin
  if new.game_slug in ('sabasaba_normal', 'sabasaba_endless') then
    if coalesce(new.metadata ->> 'source', '') <> 'sabasaba_verified'
       or coalesce(new.metadata ->> 'play_token', '') = '' then
      raise exception 'verified sabasaba submission required';
    end if;
    if not exists (
      select 1
      from private.sabasaba_run_sessions s
      where s.play_token::text = new.metadata ->> 'play_token'
        and s.status = 'submitted'
        and s.game_slug = new.game_slug
        and s.normalized_name = new.normalized_name
        and s.score = new.score
    ) then
      raise exception 'verified sabasaba session mismatch';
    end if;
  end if;
  return new;
end;
$snapshot$;
REVOKE ALL ON FUNCTION "private"."guard_sabasaba_score_runs"() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION "private"."guard_verified_score_write"() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_game_slug text;
  v_run_token_text text;
  v_run_token uuid;
  v_tomatoku_run private.tomatoku_runs_v1%rowtype;
  v_akerun_run private.akerun_runs_v1%rowtype;
begin
  v_game_slug := case when tg_op = 'DELETE' then old.game_slug else new.game_slug end;

  if v_game_slug in ('sabasaba_normal', 'sabasaba_endless') then
    v_run_token_text := nullif(current_setting('app.sabasaba_verified_run', true), '');
    begin
      v_run_token := v_run_token_text::uuid;
    exception when others then
      raise exception 'verified sabasaba score write requires a valid run';
    end;
    if not exists (
      select 1 from private.sabasaba_run_sessions s
      where s.play_token = v_run_token
        and s.game_slug = v_game_slug
        and s.status in ('started', 'submitted')
        and s.normalized_name = new.normalized_name
    ) then
      raise exception 'verified sabasaba score write requires an active run';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_game_slug = 'akerun' then
    v_run_token_text := nullif(current_setting('app.akerun_verified_run', true), '');
    begin
      v_run_token := v_run_token_text::uuid;
    exception when others then
      raise exception 'verified akerun score write requires a valid run';
    end;
    select * into v_akerun_run
    from private.akerun_runs_v1 r
    where r.run_token = v_run_token
      and r.game_slug = v_game_slug
      and r.status = 'active';
    if not found then
      raise exception 'verified akerun score write requires an active run';
    end if;
    if new.normalized_name is distinct from v_akerun_run.normalized_name then
      raise exception 'verified akerun score write does not match the active run';
    end if;
    if tg_table_name = 'score_runs' then
      if new.score is distinct from v_akerun_run.score
         or new.client_version is distinct from v_akerun_run.client_version
         or new.metadata ->> 'source' is distinct from 'akerun_verified_v2'
      then
        raise exception 'verified akerun score write values do not match the active run';
      end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- 既存 tomatoku / 将来の verified 契約の挙動は維持する。
  if exists (
    select 1 from public.games g
    where g.game_slug = v_game_slug
      and g.submission_mode = 'verified'
  ) then
    if current_setting('app.tomatoku_verified_admin', true) = 'review' then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
    v_run_token_text := nullif(current_setting('app.tomatoku_verified_run', true), '');
    begin
      v_run_token := v_run_token_text::uuid;
    exception when others then
      raise exception 'verified score write requires a valid run';
    end;
    select * into v_tomatoku_run
    from private.tomatoku_runs_v1 r
    where r.run_token = v_run_token
      and r.game_slug = v_game_slug
      and r.status = 'active';
    if not found then
      raise exception 'verified score write requires an active run';
    end if;
    if new.normalized_name is distinct from v_tomatoku_run.normalized_name then
      raise exception 'verified score write does not match the active run';
    end if;
    if tg_table_name = 'score_runs' then
      if new.score is distinct from v_tomatoku_run.score
         or new.client_version is distinct from v_tomatoku_run.client_version
      then
        raise exception 'verified score write values do not match the active run';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$snapshot$;
REVOKE ALL ON FUNCTION "private"."guard_verified_score_write"() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION "public"."finish_game_play_v1"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer DEFAULT NULL::integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_game public.games%rowtype;
  v_session private.game_play_sessions%rowtype;
  v_display_name text;
  v_normalized_name text;
  v_game_slug text;
  v_result_type text;
  v_client_version text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_play_id is null
     or p_display_name is null
     or p_game_slug is null
     or p_result_type is null
     or p_reached_wave is null
     or p_score is null
     or p_client_version is null then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'required_input_missing'
    );
  end if;

  v_display_name := btrim(p_display_name);
  v_game_slug := lower(btrim(p_game_slug));
  v_result_type := lower(btrim(p_result_type));
  v_client_version := btrim(p_client_version);
  v_normalized_name := public.normalize_player_name(v_display_name);

  if p_display_name <> v_display_name
     or p_game_slug <> v_game_slug
     or p_result_type <> v_result_type
     or char_length(v_display_name) < 1
     or char_length(v_display_name) > 20
     or v_result_type not in ('clear', 'game_over', 'retire')
     or p_reached_wave < 1
     or p_reached_wave > 30
     or p_client_version <> v_client_version
     or char_length(v_client_version) < 1
     or char_length(v_client_version) > 80 then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'invalid_input'
    );
  end if;

  if p_score < 0
     or (p_ranking_score is not null and p_ranking_score < 0) then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'invalid_score'
    );
  end if;

  select *
  into v_game
  from public.games
  where game_slug = v_game_slug
    and is_active is true
    and submission_mode = 'shared'
  for share;

  if not found then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'game_not_available',
      'game_slug', v_game_slug
    );
  end if;

  if p_score < v_game.score_min or p_score > v_game.score_max then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'score_out_of_range',
      'score_min', v_game.score_min,
      'score_max', v_game.score_max
    );
  end if;

  -- Takkeu's ranking count and game-over count must be identical.
  if v_game_slug = 'takkeu' and p_ranking_score is distinct from p_score then
    return jsonb_build_object('accepted', false, 'reason', 'takkeu_ranking_score_mismatch');
  end if;

  select *
  into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_not_found'
    );
  end if;

  if v_session.game_slug <> v_game_slug
     or v_session.normalized_name <> v_normalized_name
     or v_session.client_version <> v_client_version then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_payload_mismatch'
    );
  end if;

  -- Takkeu only: bound reported hits by server wall time, not client time.
  -- 35 hits/s gives headroom above the 30-ball game's physics bound.
  -- The 150-hit allowance protects against short bursts and existing runs.
  if v_game_slug = 'takkeu' and p_score > 0
     and p_score::numeric > 35::numeric * greatest(0::numeric,
         extract(epoch from (v_now - v_session.started_at))::numeric) + 150::numeric then
    return jsonb_build_object('accepted', false, 'reason', 'takkeu_score_rate_impossible');
  end if;

  -- An unfinished provisional retirement can still be finalized normally.
  if v_session.finished_at is not null then
    if v_session.result_type = v_result_type
       and v_session.reached_wave = p_reached_wave
       and v_session.score = p_score
       and v_session.ranking_score is not distinct from p_ranking_score then
      return jsonb_build_object(
        'accepted', true,
        'duplicate', true,
        'play_id', p_play_id,
        'game_slug', v_game_slug,
        'result_type', v_result_type,
        'reached_wave', p_reached_wave,
        'score', p_score
      );
    end if;

    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_already_finished'
    );
  end if;

  v_now := pg_catalog.clock_timestamp();

  update private.game_play_sessions
  set
    result_type = v_result_type,
    reached_wave = p_reached_wave,
    score = p_score,
    ranking_score = p_ranking_score,
    finished_at = v_now,
    updated_at = v_now
  where play_id = p_play_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'play_id', p_play_id,
    'game_slug', v_game_slug,
    'result_type', v_result_type,
    'reached_wave', p_reached_wave,
    'score', p_score,
    'finished_at', v_now
  );
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."finish_game_play_v1"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."finish_game_play_v1"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer) TO "anon";
CREATE FUNCTION "public"."finish_takkeu_play_v2"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer, p_lost_balls integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_session private.game_play_sessions%rowtype;
  v_result jsonb;
begin
  if p_play_id is null
     or p_display_name is null
     or p_game_slug is distinct from 'takkeu'
     or p_result_type is null
     or p_score is null
     or p_client_version is null
     or p_lost_balls is null
     or p_lost_balls not between 0 and 100 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;

  -- Empty stock and the 100th loss both cause game over; do not assert 100 losses.
  if p_result_type = 'game_over' and p_lost_balls = 0 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'game_over_needs_loss');
  end if;

  select * into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found or v_session.game_slug <> 'takkeu' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_unavailable');
  end if;

  if v_session.normalized_name is distinct from public.normalize_player_name(p_display_name)
     or v_session.client_version is distinct from p_client_version then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_payload_mismatch');
  end if;

  -- A legacy finished play has no trustworthy final count; never infer or backfill it.
  if v_session.finished_at is not null and v_session.takkeu_final_lost_balls is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'legacy_finish_without_lost_balls');
  end if;

  if v_session.takkeu_final_lost_balls is not null
     and v_session.takkeu_final_lost_balls <> p_lost_balls then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'lost_balls_conflict');
  end if;

  -- A reported final count cannot go backwards from an already stored snapshot.
  if exists (
    select 1 from private.takkeu_progress_v1 as progress
    where progress.play_id = p_play_id
      and progress.last_lost_balls > p_lost_balls
  ) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'lost_balls_below_last_progress');
  end if;

  v_result := public.finish_game_play_v1(
    p_play_id, p_display_name, p_game_slug,
    p_result_type, p_reached_wave, p_score,
    p_client_version, p_ranking_score
  );

  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then
    return v_result;
  end if;

  update private.game_play_sessions
  set takkeu_final_lost_balls = p_lost_balls
  where play_id = p_play_id
    and (takkeu_final_lost_balls is null or takkeu_final_lost_balls = p_lost_balls);

  if not found then
    raise exception 'lost ball count did not persist' using errcode = 'PT500';
  end if;

  return v_result || pg_catalog.jsonb_build_object('lost_balls', p_lost_balls);
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."finish_takkeu_play_v2"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer, p_lost_balls integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."finish_takkeu_play_v2"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer, p_lost_balls integer) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."finish_takkeu_play_v2"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer, p_lost_balls integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."finish_takkeu_play_v2"(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer, p_lost_balls integer) TO "service_role";
CREATE FUNCTION "public"."get_best_score_ranking"(p_game_slug text, p_limit integer DEFAULT 100) RETURNS TABLE(rank_no bigint, display_name text, first_score integer, best_score integer, play_count integer, updated_at timestamp with time zone) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $snapshot$
begin
  return query
  with play_counts as (
    select
      s.normalized_name,
      s.game_slug,
      count(*)::integer as started_play_count,
      max(s.updated_at) as last_played_at
    from private.game_play_sessions as s
    where s.game_slug = lower(btrim(p_game_slug))
    group by s.normalized_name, s.game_slug
  ),
  game_config as (
    select coalesce(g.score_order, 'desc') as score_order
    from public.games as g
    where g.game_slug = lower(btrim(p_game_slug))
    limit 1
  ),
  ranked as (
    select
      rank() over (
        order by
          case when coalesce((select score_order from game_config), 'desc') = 'asc'
            then gs.best_score end asc nulls last,
          case when coalesce((select score_order from game_config), 'desc') <> 'asc'
            then gs.best_score end desc nulls last
      ) as rank_no,
      gs.display_name,
      gs.first_score,
      gs.best_score,
      greatest(coalesce(pc.started_play_count, 0), gs.play_count)::integer as play_count,
      greatest(gs.updated_at, coalesce(pc.last_played_at, gs.updated_at)) as updated_at
    from public.game_scores as gs
    left join play_counts as pc
      on pc.normalized_name = gs.normalized_name
     and pc.game_slug = gs.game_slug
    where gs.game_slug = lower(btrim(p_game_slug))
      and gs.first_score is not null
      and coalesce(gs.ranking_status, 'normal') = 'normal'
  )
  select ranked.rank_no, ranked.display_name, ranked.first_score, ranked.best_score,
         ranked.play_count, ranked.updated_at
  from ranked
  order by ranked.rank_no asc, ranked.updated_at asc, ranked.display_name asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."get_best_score_ranking"(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."get_best_score_ranking"(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_best_score_ranking"(p_game_slug text, p_limit integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_best_score_ranking"(p_game_slug text, p_limit integer) TO "service_role";
CREATE FUNCTION "public"."get_takkeu_player_position_v1"(p_normalized_name text) RETURNS TABLE(rank_no bigint, total_entries bigint, best_score integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $snapshot$
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
$snapshot$;
REVOKE ALL ON FUNCTION "public"."get_takkeu_player_position_v1"(p_normalized_name text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."get_takkeu_player_position_v1"(p_normalized_name text) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_takkeu_player_position_v1"(p_normalized_name text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_takkeu_player_position_v1"(p_normalized_name text) TO "service_role";
CREATE FUNCTION "public"."normalize_player_name"(input_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $snapshot$
  select btrim(coalesce(input_name, ''));
$snapshot$;
REVOKE ALL ON FUNCTION "public"."normalize_player_name"(input_name text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."normalize_player_name"(input_name text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."normalize_player_name"(input_name text) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."normalize_player_name"(input_name text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."normalize_player_name"(input_name text) TO "service_role";
CREATE FUNCTION "public"."report_takkeu_progress_v1"(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_session private.game_play_sessions%rowtype;
  v_prior private.takkeu_progress_v1%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_total_seconds numeric;
  v_delta_seconds numeric;
  v_signal text := null;
  v_high_density boolean;
begin
  if p_play_id is null or p_display_name is null or p_client_version is null
      or p_score is null or p_sim_seconds is null or p_ball_count is null
      or p_lost_balls is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'missing_input');
  end if;
  if p_score < 0 or p_ball_count not between 0 and 30
      or p_lost_balls not between 0 and 100 or p_sim_seconds < 0
      or p_sim_seconds > 43200 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;
  select * into v_session from private.game_play_sessions
  where play_id = p_play_id and game_slug = 'takkeu'
    and normalized_name = public.normalize_player_name(p_display_name)
    and client_version = p_client_version
  for update;
  if not found or v_session.finished_at is not null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_unavailable');
  end if;

  v_total_seconds := greatest(0::numeric,
      extract(epoch from v_now - v_session.started_at)::numeric);
  select * into v_prior from private.takkeu_progress_v1 where play_id = p_play_id for update;
  v_delta_seconds := case when found then
    greatest(0::numeric, extract(epoch from v_now - v_prior.last_report_at)::numeric)
  else v_total_seconds end;
  -- Per-play rate limit: excessive progress calls never update the private tables.
  if v_prior.play_id is not null and v_delta_seconds < 5 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'report_too_frequent');
  end if;
  if v_prior.play_id is not null and v_prior.report_count >= 240 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'report_limit_reached');
  end if;
  if p_sim_seconds > v_total_seconds + 5 then
    v_signal := 'sim_time_invalid';
  elsif v_prior.play_id is not null and (p_score < v_prior.last_score
      or p_sim_seconds < v_prior.last_sim_seconds
      or p_lost_balls < v_prior.last_lost_balls) then
    v_signal := 'non_monotonic';
  elsif p_score::numeric > 40::numeric * v_total_seconds + 150
      or (v_prior.play_id is not null
        and (p_score - v_prior.last_score)::numeric > 40::numeric * v_delta_seconds + 150) then
    v_signal := 'invalid_rate';
  end if;
  if v_signal is not null then
    insert into private.takkeu_progress_signals_v1
      (play_id, reason, latest_score, first_seen_at, last_seen_at, occurrence_count)
    values (p_play_id, v_signal, p_score, v_now, v_now, 1)
    on conflict (play_id, reason) do update set
      latest_score = excluded.latest_score,
      last_seen_at = excluded.last_seen_at,
      occurrence_count = private.takkeu_progress_signals_v1.occurrence_count + 1;
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', v_signal);
  end if;
  -- Heuristic only, can be legitimate multiball gameplay; never label BOT automatically.
  v_high_density := p_score::numeric > 30::numeric * v_total_seconds + 60;
  insert into private.takkeu_progress_v1
    (play_id, last_score, last_sim_seconds, last_ball_count,
     last_lost_balls, first_report_at, last_report_at, report_count, high_density_signal)
  values
    (p_play_id, p_score, p_sim_seconds, p_ball_count, p_lost_balls,
     v_now, v_now, 1, v_high_density)
  on conflict (play_id) do update set
    last_score = excluded.last_score,
    last_sim_seconds = excluded.last_sim_seconds,
    last_ball_count = excluded.last_ball_count,
    last_lost_balls = excluded.last_lost_balls,
    last_report_at = excluded.last_report_at,
    report_count = private.takkeu_progress_v1.report_count + 1,
    high_density_signal = private.takkeu_progress_v1.high_density_signal or excluded.high_density_signal;
  if v_high_density then
    insert into private.takkeu_progress_signals_v1
      (play_id, reason, latest_score, first_seen_at, last_seen_at, occurrence_count)
    values (p_play_id, 'high_density', p_score, v_now, v_now, 1)
    on conflict (play_id, reason) do update set
      latest_score = excluded.latest_score,
      last_seen_at = excluded.last_seen_at,
      occurrence_count = private.takkeu_progress_signals_v1.occurrence_count + 1;
  end if;
  return pg_catalog.jsonb_build_object('accepted', true, 'high_density_signal', v_high_density);
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."report_takkeu_progress_v1"(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."report_takkeu_progress_v1"(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."report_takkeu_progress_v1"(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."report_takkeu_progress_v1"(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer) TO "service_role";
CREATE FUNCTION "public"."start_game_play_v1"(p_start_id uuid, p_display_name text, p_game_slug text, p_client_version text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_game public.games%rowtype;
  v_existing private.game_play_sessions%rowtype;
  v_display_name text;
  v_normalized_name text;
  v_game_slug text;
  v_client_version text;
  v_play_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_start_id is null
     or p_display_name is null
     or p_game_slug is null
     or p_client_version is null then
    return pg_catalog.jsonb_build_object(
      'accepted', false,
      'reason', 'required_input_missing'
    );
  end if;

  v_display_name := pg_catalog.btrim(p_display_name);
  v_game_slug := pg_catalog.lower(pg_catalog.btrim(p_game_slug));
  v_client_version := pg_catalog.btrim(p_client_version);

  if p_display_name <> v_display_name
     or p_game_slug <> v_game_slug
     or pg_catalog.char_length(v_display_name) < 1
     or pg_catalog.char_length(v_display_name) > 20
     or pg_catalog.char_length(v_game_slug) < 1
     or pg_catalog.char_length(v_game_slug) > 80
     or pg_catalog.char_length(v_client_version) < 1
     or pg_catalog.char_length(v_client_version) > 80 then
    return pg_catalog.jsonb_build_object(
      'accepted', false,
      'reason', 'invalid_input'
    );
  end if;

  v_normalized_name := public.normalize_player_name(v_display_name);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_start_id::text, 0::bigint)
  );

  select *
  into v_existing
  from private.game_play_sessions
  where start_id = p_start_id
  for update;

  if found then
    if v_existing.game_slug <> v_game_slug
       or v_existing.normalized_name <> v_normalized_name
       or v_existing.client_version <> v_client_version then
      return pg_catalog.jsonb_build_object(
        'accepted', false,
        'reason', 'start_id_conflict'
      );
    end if;

    return pg_catalog.jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'start_id', p_start_id,
      'play_id', v_existing.play_id,
      'game_slug', v_existing.game_slug,
      'display_name', v_existing.display_name,
      'normalized_name', v_existing.normalized_name,
      'client_version', v_existing.client_version,
      'started_at', v_existing.started_at
    );
  end if;

  select *
  into v_game
  from public.games
  where game_slug = v_game_slug
    and is_active is true
    and submission_mode = 'shared'
  for share;

  if not found then
    return pg_catalog.jsonb_build_object(
      'accepted', false,
      'reason', 'game_not_available',
      'game_slug', v_game_slug
    );
  end if;

  if (
    select count(*)
    from private.game_play_sessions
    where game_slug = v_game_slug
      and normalized_name = v_normalized_name
      and started_at >= v_now - interval '1 minute'
  ) >= 60 then
    return pg_catalog.jsonb_build_object(
      'accepted', false,
      'reason', 'play_rate_limited',
      'game_slug', v_game_slug
    );
  end if;

  insert into public.players (
    normalized_name,
    display_name,
    created_at,
    last_played_at
  )
  values (
    v_normalized_name,
    v_display_name,
    v_now,
    v_now
  )
  on conflict (normalized_name) do update set
    display_name = excluded.display_name,
    last_played_at = excluded.last_played_at;

  v_play_id := pg_catalog.gen_random_uuid();

  insert into private.game_play_sessions (
    start_id,
    play_id,
    game_slug,
    normalized_name,
    display_name,
    client_version,
    result_type,
    reached_wave,
    score,
    started_at,
    created_at,
    updated_at
  )
  values (
    p_start_id,
    v_play_id,
    v_game_slug,
    v_normalized_name,
    v_display_name,
    v_client_version,
    -- A start without a finish is a provisional retirement.
    'retire',
    1,
    0,
    v_now,
    v_now,
    v_now
  );

  return pg_catalog.jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'start_id', p_start_id,
    'play_id', v_play_id,
    'game_slug', v_game_slug,
    'display_name', v_display_name,
    'normalized_name', v_normalized_name,
    'client_version', v_client_version,
    'started_at', v_now
  );
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."start_game_play_v1"(p_start_id uuid, p_display_name text, p_game_slug text, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."start_game_play_v1"(p_start_id uuid, p_display_name text, p_game_slug text, p_client_version text) TO "anon";
CREATE FUNCTION "public"."start_takkeu_guest_play_v1"(p_start_id uuid, p_game_slug text, p_client_version text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_existing private.takkeu_guest_plays_v1%rowtype;
  v_play_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_start_id is null or p_game_slug is null or p_client_version is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'required_input_missing');
  end if;
  if p_game_slug <> 'takkeu' or p_client_version <> pg_catalog.btrim(p_client_version)
     or pg_catalog.char_length(p_client_version) not between 1 and 80 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_start_id::text, 0::bigint));
  select * into v_existing from private.takkeu_guest_plays_v1 where start_id = p_start_id for update;
  if found then
    if v_existing.client_version <> p_client_version then
      return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'start_id_conflict');
    end if;
    return pg_catalog.jsonb_build_object('accepted', true, 'duplicate', true, 'start_id', p_start_id,
      'play_id', v_existing.play_id, 'game_slug', 'takkeu', 'client_version', v_existing.client_version);
  end if;
  if exists (select 1 from private.game_play_sessions where start_id = p_start_id) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'start_id_conflict');
  end if;
  perform 1 from public.games where game_slug = 'takkeu' and is_active is true and submission_mode = 'shared' for share;
  if not found then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'game_not_available');
  end if;
  -- Coarse flood protection, not guest identification.
  if (select count(*) from private.takkeu_guest_plays_v1 where started_at >= v_now - interval '1 minute') >= 10000 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_rate_limited');
  end if;
  insert into private.takkeu_guest_plays_v1 (start_id, client_version, started_at)
    values (p_start_id, p_client_version, v_now) returning play_id into v_play_id;
  return pg_catalog.jsonb_build_object('accepted', true, 'duplicate', false, 'start_id', p_start_id,
    'play_id', v_play_id, 'game_slug', 'takkeu', 'client_version', p_client_version);
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."start_takkeu_guest_play_v1"(p_start_id uuid, p_game_slug text, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."start_takkeu_guest_play_v1"(p_start_id uuid, p_game_slug text, p_client_version text) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."start_takkeu_guest_play_v1"(p_start_id uuid, p_game_slug text, p_client_version text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."start_takkeu_guest_play_v1"(p_start_id uuid, p_game_slug text, p_client_version text) TO "service_role";
CREATE FUNCTION "public"."submit_score_idempotent_v1"(p_play_id uuid, p_submission_id uuid, p_display_name text, p_game_slug text, p_score integer, p_client_version text) RETURNS TABLE(accepted boolean, result_submission_id uuid, result_play_id uuid, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean, was_duplicate boolean) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $snapshot$
declare
  v_game public.games%rowtype;
  v_session private.game_play_sessions%rowtype;
  v_existing public.score_runs%rowtype;
  v_score public.game_scores%rowtype;
  v_display_name text;
  v_normalized_name text;
  v_game_slug text;
  v_client_version text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_run_id bigint;
  v_is_first_play boolean := false;
  v_is_new_best boolean := false;
  v_result_first_score integer;
  v_result_best_score integer;
  v_result_play_count integer;
  v_existing_submission boolean := false;
begin
  if p_play_id is null
     or p_submission_id is null
     or p_display_name is null
     or p_game_slug is null
     or p_score is null
     or p_client_version is null then
    raise exception 'required input is missing'
      using errcode = '22023';
  end if;

  v_display_name := btrim(p_display_name);
  v_normalized_name := public.normalize_player_name(v_display_name);
  v_game_slug := lower(btrim(p_game_slug));
  v_client_version := btrim(p_client_version);

  if p_display_name <> v_display_name
     or p_game_slug <> v_game_slug
     or char_length(v_display_name) < 1
     or char_length(v_display_name) > 20
     or char_length(v_game_slug) < 1
     or char_length(v_game_slug) > 80
     or char_length(v_client_version) < 1
     or char_length(v_client_version) > 80 then
    raise exception 'ranking submission input is invalid'
      using errcode = '22023';
  end if;

  select *
  into v_game
  from public.games
  where game_slug = v_game_slug
    and is_active is true
    and submission_mode = 'shared'
  for share;

  if not found then
    raise exception 'game is not available for this submission contract'
      using errcode = '42501';
  end if;

  if p_score < v_game.score_min or p_score > v_game.score_max then
    raise exception 'score is outside the game range'
      using errcode = '22003';
  end if;

  select *
  into v_existing
  from public.score_runs
  where submission_id = p_submission_id
  for update;

  if found then
    if v_existing.play_id is distinct from p_play_id
       or v_existing.game_slug <> v_game_slug
       or v_existing.normalized_name <> v_normalized_name
       or v_existing.score <> p_score
       or coalesce(v_existing.client_version, '') <> v_client_version then
      raise exception 'submission id payload does not match'
        using errcode = 'PT409';
    end if;

    select *
    into v_score
    from public.game_scores
    where normalized_name = v_normalized_name
      and game_slug = v_game_slug;

    if not found then
      raise exception 'submission aggregate is unavailable'
        using errcode = 'PT500';
    end if;

    v_result_first_score :=
      coalesce(nullif(v_existing.metadata ->> 'result_first_score', '')::integer, v_score.first_score);
    v_result_best_score :=
      coalesce(nullif(v_existing.metadata ->> 'result_best_score', '')::integer, v_score.best_score);
    v_result_play_count :=
      coalesce(nullif(v_existing.metadata ->> 'result_play_count', '')::integer, v_score.play_count);

    return query
    select
      true,
      p_submission_id,
      p_play_id,
      v_score.normalized_name,
      v_score.display_name,
      v_result_first_score,
      v_result_best_score,
      v_result_play_count,
      coalesce((v_existing.metadata ->> 'is_first_play')::boolean, false),
      coalesce((v_existing.metadata ->> 'is_new_best')::boolean, false),
      true;
    return;
  end if;

  select *
  into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found then
    raise exception 'play is unavailable'
      using errcode = 'PT410';
  end if;

  if v_session.game_slug <> v_game_slug
     or v_session.normalized_name <> v_normalized_name
     or v_session.client_version <> v_client_version then
    raise exception 'play payload does not match'
      using errcode = 'PT409';
  end if;

  -- A provisional retirement is not submittable until finish_game_play_v1 runs.
  if v_session.finished_at is null then
    raise exception 'play has not been finished'
      using errcode = 'PT425';
  end if;

  -- Closing a real play is not proof that the separately supplied score is real.
  if v_game_slug = 'takkeu' and (v_session.score is distinct from p_score
     or v_session.ranking_score is distinct from p_score) then
    raise exception 'takkeu finished score does not match submitted score'
      using errcode = 'PT409';
  end if;

  if v_session.submission_id is not null
     and v_session.submission_id <> p_submission_id then
    raise exception 'play already has another submission'
      using errcode = 'PT409';
  end if;

  if (
    select count(*)
    from public.score_runs
    where game_slug = v_game_slug
      and normalized_name = v_normalized_name
      and play_id is not null
      and created_at >= v_now - interval '1 minute'
  ) >= 60 then
    raise exception 'score submission rate limit exceeded'
      using errcode = '42900';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_game_slug || ':' || v_normalized_name,
      0::bigint
    )
  );

  insert into public.score_runs (
    normalized_name,
    game_slug,
    score,
    client_version,
    created_at,
    metadata,
    play_id,
    submission_id
  )
  values (
    v_normalized_name,
    v_game_slug,
    p_score,
    v_client_version,
    v_now,
    jsonb_build_object('contract_version', 'ranking-submission-v1'),
    p_play_id,
    p_submission_id
  )
  on conflict do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select *
    into v_existing
    from public.score_runs
    where submission_id = p_submission_id
    for update;

    if found then
      if v_existing.play_id is distinct from p_play_id
         or v_existing.game_slug <> v_game_slug
         or v_existing.normalized_name <> v_normalized_name
         or v_existing.score <> p_score
         or coalesce(v_existing.client_version, '') <> v_client_version then
        raise exception 'submission id payload does not match'
          using errcode = 'PT409';
      end if;

      select *
      into v_score
      from public.game_scores
      where normalized_name = v_normalized_name
        and game_slug = v_game_slug;

      if not found then
        raise exception 'submission aggregate is unavailable'
          using errcode = 'PT500';
      end if;

      return query
      select
        true,
        p_submission_id,
        p_play_id,
        v_score.normalized_name,
        v_score.display_name,
        coalesce(nullif(v_existing.metadata ->> 'result_first_score', '')::integer, v_score.first_score),
        coalesce(nullif(v_existing.metadata ->> 'result_best_score', '')::integer, v_score.best_score),
        coalesce(nullif(v_existing.metadata ->> 'result_play_count', '')::integer, v_score.play_count),
        coalesce((v_existing.metadata ->> 'is_first_play')::boolean, false),
        coalesce((v_existing.metadata ->> 'is_new_best')::boolean, false),
        true;
      return;
    end if;

    raise exception 'submission conflicts with an existing play'
      using errcode = 'PT409';
  end if;

  select *
  into v_score
  from public.game_scores
  where normalized_name = v_normalized_name
    and game_slug = v_game_slug
  for update;

  if not found then
    v_is_first_play := true;
    v_is_new_best := true;

    insert into public.game_scores (
      normalized_name,
      game_slug,
      display_name,
      first_score,
      best_score,
      play_count,
      first_score_at,
      best_score_at,
      updated_at
    )
    values (
      v_normalized_name,
      v_game_slug,
      v_display_name,
      p_score,
      p_score,
      1,
      v_now,
      v_now,
      v_now
    )
    returning * into v_score;
  else
    v_is_new_best :=
      (v_game.score_order = 'desc' and p_score > v_score.best_score)
      or (v_game.score_order = 'asc' and p_score < v_score.best_score);

    update public.game_scores
    set
      display_name = v_display_name,
      best_score = case when v_is_new_best then p_score else best_score end,
      play_count = v_score.play_count + 1,
      best_score_at = case when v_is_new_best then v_now else best_score_at end,
      updated_at = v_now
    where normalized_name = v_normalized_name
      and game_slug = v_game_slug
    returning * into v_score;
  end if;

  v_result_first_score := v_score.first_score;
  v_result_best_score := v_score.best_score;
  v_result_play_count := v_score.play_count;

  update public.score_runs
  set metadata = jsonb_build_object(
    'contract_version', 'ranking-submission-v1',
    'result_first_score', v_result_first_score,
    'result_best_score', v_result_best_score,
    'result_play_count', v_result_play_count,
    'is_first_play', v_is_first_play,
    'is_new_best', v_is_new_best
  )
  where id = v_run_id;

  update private.game_play_sessions
  set
    submission_id = p_submission_id,
    updated_at = v_now
  where play_id = p_play_id;

  return query
  select
    true,
    p_submission_id,
    p_play_id,
    v_score.normalized_name,
    v_score.display_name,
    v_score.first_score,
    v_score.best_score,
    v_score.play_count,
    v_is_first_play,
    v_is_new_best,
    false;
end;
$snapshot$;
REVOKE ALL ON FUNCTION "public"."submit_score_idempotent_v1"(p_play_id uuid, p_submission_id uuid, p_display_name text, p_game_slug text, p_score integer, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."submit_score_idempotent_v1"(p_play_id uuid, p_submission_id uuid, p_display_name text, p_game_slug text, p_score integer, p_client_version text) TO "anon";
SET check_function_bodies=on;
ALTER FUNCTION public.normalize_player_name(text) SET search_path=pg_catalog,public;
CREATE TRIGGER guard_verified_game_scores BEFORE INSERT OR UPDATE ON public.game_scores FOR EACH ROW EXECUTE FUNCTION private.guard_verified_score_write();
CREATE POLICY "game_scores_select_public" ON "public"."game_scores" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
GRANT TRUNCATE,REFERENCES,TRIGGER ON "public"."game_scores" TO "service_role";
GRANT TRUNCATE,REFERENCES,TRIGGER ON "public"."players" TO "service_role";
CREATE TRIGGER attach_takkeu_final_losses_to_score_runs_v1 BEFORE INSERT OR UPDATE OF metadata ON public.score_runs FOR EACH ROW EXECUTE FUNCTION private.attach_takkeu_final_losses_v1();
CREATE TRIGGER guard_sabasaba_verified_score_runs BEFORE INSERT ON public.score_runs FOR EACH ROW EXECUTE FUNCTION private.guard_sabasaba_score_runs();
CREATE TRIGGER guard_verified_score_runs BEFORE INSERT OR UPDATE ON public.score_runs FOR EACH ROW EXECUTE FUNCTION private.guard_verified_score_write();
GRANT TRUNCATE,REFERENCES,TRIGGER ON "public"."score_runs" TO "service_role";
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLES TO service_role;
INSERT INTO public.games(game_slug,title,game_url,score_unit,top_ranking_type,score_order,score_min,score_max,is_active,submission_mode) VALUES ('takkeu','Offline fixture','https://example.invalid','rally','best','desc',0,100000000,true,'shared');
GRANT USAGE ON SCHEMA public,supabase_migrations TO release_reader;
GRANT SELECT(game_slug,is_active,submission_mode,score_order,score_min,score_max) ON public.games TO release_reader;
CREATE POLICY takkeu_release_config_read ON public.games FOR SELECT TO release_reader USING(game_slug='takkeu');
GRANT SELECT(version,name) ON supabase_migrations.schema_migrations TO release_reader;
GRANT MAINTAIN ON public.players,public.game_scores,public.score_runs TO anon,authenticated,service_role;

-- Reviewed nonvolatile SQL closure; no data is copied.
SET check_function_bodies=off;
CREATE FUNCTION private.get_game_player_counts_v1(p_game_slug text) RETURNS TABLE(normalized_name text, display_name text, play_count integer, first_score integer, best_score integer, updated_at timestamp with time zone) LANGUAGE sql STABLE SET search_path TO '' AS $readonly_snapshot$
  with session_counts as (
    select
      s.normalized_name,
      max(s.display_name) as display_name,
      count(*)::integer as play_count,
      max(s.updated_at) as updated_at
    from private.game_play_sessions as s
    where s.game_slug = pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, '')))
    group by s.normalized_name
  ),
  score_counts as (
    select
      gs.normalized_name, gs.display_name, gs.play_count,
      gs.first_score, gs.best_score, gs.updated_at, gs.ranking_status
    from public.game_scores as gs
    where gs.game_slug = pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, '')))
  )
  select
    coalesce(gs.normalized_name, sc.normalized_name) as normalized_name,
    coalesce(gs.display_name, sc.display_name) as display_name,
    greatest(coalesce(gs.play_count, 0), coalesce(sc.play_count, 0))::integer as play_count,
    gs.first_score,
    gs.best_score,
    greatest(gs.updated_at, sc.updated_at) as updated_at
  from score_counts as gs
  full join session_counts as sc on sc.normalized_name = gs.normalized_name
  where coalesce(gs.ranking_status, 'normal') = 'normal';
$readonly_snapshot$;
REVOKE ALL ON FUNCTION private.get_game_player_counts_v1(p_game_slug text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.get_disqualified_score_entries(p_game_slug text, p_limit integer DEFAULT 50) RETURNS TABLE(display_name text, ranking_status text, ranking_note text, first_score integer, best_score integer, play_count integer, updated_at timestamp with time zone, ranking_status_updated_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $readonly_snapshot$
  select
    gs.display_name,
    gs.ranking_status,
    gs.ranking_note,
    gs.first_score,
    gs.best_score,
    gs.play_count,
    gs.updated_at,
    gs.ranking_status_updated_at
  from public.game_scores gs
  where gs.game_slug = p_game_slug
    and p_game_slug not in ('sabasaba_normal', 'sabasaba_endless')
    and gs.ranking_status = 'disqualified'
  order by
    gs.ranking_status_updated_at desc nulls last,
    gs.updated_at desc,
    gs.display_name asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_disqualified_score_entries(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_disqualified_score_entries(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_disqualified_score_entries(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_disqualified_score_entries(p_game_slug text, p_limit integer) TO "authenticated";
CREATE FUNCTION public.get_first_try_ranking(p_game_slug text, p_limit integer DEFAULT 100) RETURNS TABLE(rank_no bigint, display_name text, first_score integer, best_score integer, play_count integer, updated_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $readonly_snapshot$
  with play_counts as (
    select
      s.normalized_name,
      s.game_slug,
      count(*)::integer as started_play_count,
      max(s.updated_at) as last_played_at
    from private.game_play_sessions as s
    where s.game_slug = lower(btrim(p_game_slug))
    group by s.normalized_name, s.game_slug
  ),
  ranked as (
    select
      rank() over (
        order by
          case when coalesce((select score_order from public.games where game_slug = lower(btrim(p_game_slug)) limit 1), 'desc') = 'asc'
            then gs.first_score end asc nulls last,
          case when coalesce((select score_order from public.games where game_slug = lower(btrim(p_game_slug)) limit 1), 'desc') <> 'asc'
            then gs.first_score end desc nulls last
      ) as rank_no,
      gs.display_name,
      gs.first_score,
      gs.best_score,
      greatest(coalesce(pc.started_play_count, 0), gs.play_count)::integer as play_count,
      greatest(gs.updated_at, coalesce(pc.last_played_at, gs.updated_at)) as updated_at
    from public.game_scores as gs
    left join play_counts as pc
      on pc.normalized_name = gs.normalized_name
     and pc.game_slug = gs.game_slug
    where gs.game_slug = lower(btrim(p_game_slug))
      and gs.first_score is not null
      and coalesce(gs.ranking_status, 'normal') = 'normal'
  )
  select ranked.rank_no, ranked.display_name, ranked.first_score, ranked.best_score,
         ranked.play_count, ranked.updated_at
  from ranked
  order by ranked.rank_no asc, ranked.updated_at asc, ranked.display_name asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_first_try_ranking(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking(p_game_slug text, p_limit integer) TO "authenticated";
CREATE FUNCTION public.get_game_play_stats(p_game_slug text) RETURNS TABLE(total_play_count bigint, player_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $readonly_snapshot$
  select named.total_play_count + case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, ''))) = 'takkeu'
      then (select count(*) from private.takkeu_guest_plays_v1) else 0::bigint end,
    named.player_count
  from (
    select coalesce(sum(pc.play_count), 0)::bigint as total_play_count, count(*)::bigint as player_count
    from private.get_game_player_counts_v1(p_game_slug) as pc
  ) as named;
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_game_play_stats(p_game_slug text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_game_play_stats(p_game_slug text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_play_stats(p_game_slug text) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_game_play_stats(p_game_slug text) TO "authenticated";
CREATE FUNCTION public.get_hito_wo_yurusuna_best_ranking(p_limit integer DEFAULT 20) RETURNS TABLE(rank_no bigint, display_name text, clear_wave integer, score integer, play_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $readonly_snapshot$
  select
    rank() over (
      order by gs.best_score desc, gs.best_clear_wave desc, gs.display_name asc
    ) as rank_no,
    gs.display_name,
    coalesce(gs.best_clear_wave, 0) as clear_wave,
    gs.best_score as score,
    gs.play_count
  from public.game_scores gs
  where gs.game_slug = 'hito_wo_yurusuna'
  order by gs.best_score desc, gs.best_clear_wave desc, gs.display_name asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_hito_wo_yurusuna_best_ranking(p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_best_ranking(p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_best_ranking(p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_best_ranking(p_limit integer) TO "authenticated";
CREATE FUNCTION public.get_hito_wo_yurusuna_first_ranking(p_limit integer DEFAULT 20) RETURNS TABLE(rank_no bigint, display_name text, clear_wave integer, score integer, play_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $readonly_snapshot$
  select
    rank() over (
      order by gs.first_score desc, gs.first_clear_wave desc, gs.display_name asc
    ) as rank_no,
    gs.display_name,
    coalesce(gs.first_clear_wave, 0) as clear_wave,
    gs.first_score as score,
    gs.play_count
  from public.game_scores gs
  where gs.game_slug = 'hito_wo_yurusuna'
  order by gs.first_score desc, gs.first_clear_wave desc, gs.display_name asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_hito_wo_yurusuna_first_ranking(p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_first_ranking(p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_first_ranking(p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_hito_wo_yurusuna_first_ranking(p_limit integer) TO "authenticated";
CREATE FUNCTION public.get_play_count_ranking(p_game_slug text, p_limit integer DEFAULT 100) RETURNS TABLE(rank_no bigint, display_name text, play_count integer, first_score integer, best_score integer, updated_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $readonly_snapshot$
  with ranked as (
    select
      rank() over (order by pc.play_count desc) as rank_no,
      pc.display_name, pc.play_count, pc.first_score, pc.best_score, pc.updated_at
    from private.get_game_player_counts_v1(p_game_slug) as pc
  )
  select
    ranked.rank_no, ranked.display_name, ranked.play_count,
    ranked.first_score, ranked.best_score, ranked.updated_at
  from ranked
  order by ranked.rank_no asc, ranked.updated_at asc, ranked.display_name asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$readonly_snapshot$;
REVOKE ALL ON FUNCTION public.get_play_count_ranking(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_play_count_ranking(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_play_count_ranking(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_play_count_ranking(p_game_slug text, p_limit integer) TO "authenticated";
SET check_function_bodies=on;
