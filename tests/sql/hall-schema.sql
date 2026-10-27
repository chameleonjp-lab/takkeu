create schema private;
    create role anon; create role authenticated; create role service_role;
    create table public.games(game_slug text primary key,is_active boolean not null,
      submission_mode text not null,score_order text not null,score_min integer not null,score_max integer not null);
    insert into public.games values ('takkeu',true,'shared','desc',0,100000000),('other',true,'shared','desc',0,100000000);
    create table public.players(normalized_name text primary key,display_name text not null,
      created_at timestamptz not null,last_played_at timestamptz);
    create table public.game_scores(normalized_name text not null,game_slug text not null,
      display_name text not null,first_score integer,best_score integer not null,play_count integer not null,
      first_score_at timestamptz,best_score_at timestamptz,updated_at timestamptz,
      ranking_status text not null default 'normal',primary key(normalized_name,game_slug));
    create table private.game_play_sessions(play_id uuid primary key,start_id uuid unique,
      game_slug text not null,normalized_name text not null,display_name text not null,client_version text not null,
      result_type text not null default 'retire',reached_wave integer not null default 1,score integer not null default 0,
      ranking_score integer,submission_id uuid unique,started_at timestamptz not null,finished_at timestamptz,
      created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
    create table public.score_runs(id bigint generated always as identity primary key,
      normalized_name text not null,game_slug text not null,score integer not null,client_version text,
      created_at timestamptz not null default clock_timestamp(),metadata jsonb not null default '{}'::jsonb,
      play_id uuid unique,submission_id uuid unique);
    create table private.takkeu_progress_v1(play_id uuid primary key,last_lost_balls integer not null);
    create function public.submit_score_unverified(p_display_name text,p_game_slug text,p_score integer,p_client_version text)
      returns table(accepted boolean,result_normalized_name text,result_display_name text,result_first_score integer,
        result_best_score integer,result_play_count integer,is_first_play boolean,is_new_best boolean)
      language sql as $$select true,'external'::text,p_display_name,1,p_score,1,true,true;$$;
