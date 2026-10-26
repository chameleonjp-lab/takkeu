import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const started = '22222222-2222-4222-8222-222222222222';
const submitted = '33333333-3333-4333-8333-333333333333';
const version = 'takkeu-web-ranking-1';

it('atomically stores exact game-over losses and links them to the submitted score run', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
      create role anon; create role authenticated; create role service_role;
      create table public.games(
        game_slug text primary key, is_active boolean not null,
        submission_mode text not null, score_order text not null,
        score_min integer not null, score_max integer not null
      );
      insert into public.games values ('takkeu',true,'shared','desc',0,100000000);
      insert into public.games values ('other',true,'shared','desc',0,100000000);
      create table public.players(
        normalized_name text primary key, display_name text not null,
        created_at timestamptz not null, last_played_at timestamptz
      );
      create table public.game_scores(
        normalized_name text not null, game_slug text not null,
        display_name text not null, first_score integer, best_score integer not null,
        play_count integer not null, first_score_at timestamptz,
        best_score_at timestamptz, updated_at timestamptz,
        primary key (normalized_name,game_slug)
      );
      create table private.game_play_sessions(
        play_id uuid primary key, start_id uuid,
        game_slug text not null, normalized_name text not null, display_name text not null,
        client_version text not null, result_type text not null default 'retire',
        reached_wave integer not null default 1, score integer not null default 0,
        ranking_score integer, submission_id uuid unique,
        started_at timestamptz not null, finished_at timestamptz,
        created_at timestamptz not null default clock_timestamp(),
        updated_at timestamptz not null default clock_timestamp()
      );
      create table public.score_runs(
        id bigint generated always as identity primary key,
        normalized_name text not null, game_slug text not null,
        score integer not null, client_version text,
        created_at timestamptz not null default clock_timestamp(),
        metadata jsonb not null default '{}'::jsonb,
        play_id uuid unique, submission_id uuid unique
      );
      create function public.normalize_player_name(input_name text)
      returns text language sql immutable as $$ select lower(btrim(coalesce(input_name,''))); $$;
      create function public.submit_score_unverified(
        p_display_name text,p_game_slug text,p_score integer,p_client_version text
      ) returns table(
        accepted boolean,result_normalized_name text,result_display_name text,
        result_first_score integer,result_best_score integer,result_play_count integer,
        is_first_play boolean,is_new_best boolean
      ) language sql as $$select true,'external'::text,p_display_name,1,p_score,1,true,true;$$;
      insert into private.game_play_sessions
        (play_id,start_id,game_slug,normalized_name,display_name,client_version,started_at)
      values (
        '${started}','11111111-1111-4111-8111-111111111111',
        'takkeu','tester','tester','${version}',clock_timestamp()-interval '10 seconds'
      );
    `);
    await db.exec(`create table private.takkeu_progress_v1 (play_id uuid primary key, last_lost_balls integer not null);`);
    await db.exec(readFileSync('supabase/migrations/20261027_takkeu_submission_guard.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261027_takkeu_rate_limit_refinement.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261027_takkeu_final_lost_balls.sql', 'utf8'));
    const call = async (score: number, lost: number) => {
      const res = await db.query<{ result: unknown }>(
        `select public.finish_takkeu_play_v2($1::uuid,'tester','takkeu','game_over',1,$2,$3,$2,$4) as result`,
        [started, score, version, lost]
      );
      const value = res.rows[0]?.result;
      return typeof value === 'string' ? JSON.parse(value) : value;
    };
    expect(await call(42, 101)).toMatchObject({ accepted: false, reason: 'invalid_input' });
    expect(await call(42, 0)).toMatchObject({ accepted: false, reason: 'game_over_needs_loss' });
    expect(await call(999999, 1)).toMatchObject({ accepted: false, reason: 'takkeu_score_rate_impossible' });
    expect(await call(42, 1)).toMatchObject({ accepted: true, score: 42, lost_balls: 1 });
    expect((await db.query<{ count: number | null }>(
      `select takkeu_final_lost_balls as count from private.game_play_sessions where play_id=$1::uuid`, [started]
    )).rows[0]?.count).toBe(1);
    expect(await call(42, 1)).toMatchObject({ accepted: true, duplicate: true, lost_balls: 1 });
    expect(await call(42, 100)).toMatchObject({ accepted: false, reason: 'lost_balls_conflict' });
    await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'tester','takkeu',42,$3)`,
      [started, submitted, version]);
    const entries = (await db.query<{score:number;metadata:{contract_version:string;final_lost_balls:number}}>(
      `select score,metadata from public.score_runs where game_slug='takkeu'`)).rows;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({score:42,metadata:{contract_version:'ranking-submission-v1',final_lost_balls:1}});

    // A historical v1 finish has no stored count; it must stay NULL and cannot be guessed later.
    await db.exec(`insert into private.game_play_sessions
      (play_id,start_id,game_slug,normalized_name,display_name,client_version,started_at)
      values ('44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555', 'takkeu','tester','tester','takkeu-web-ranking-1',
        clock_timestamp()-interval '15 seconds');`);
    const legacy = await db.query<{ result: unknown }>(
      `select public.finish_game_play_v1('44444444-4444-4444-8444-444444444444'::uuid,
        'tester','takkeu','game_over',1,1,'takkeu-web-ranking-1',1) as result`);
    expect(legacy.rows[0]?.result).toMatchObject({ accepted: true, score: 1 });
    const noBackfill = await db.query<{ result: unknown }>(
      `select public.finish_takkeu_play_v2('44444444-4444-4444-8444-444444444444'::uuid,
        'tester','takkeu','game_over',1,1,'takkeu-web-ranking-1',1,1) as result`);
    expect(noBackfill.rows[0]?.result).toMatchObject({ accepted: false, reason: 'legacy_finish_without_lost_balls' });
    const old = await db.query<{ final_lost: number | null }>(
      `select takkeu_final_lost_balls as final_lost from private.game_play_sessions
       where play_id='44444444-4444-4444-8444-444444444444'::uuid`);
    expect(old.rows[0]?.final_lost).toBeNull();
  } finally { await db.close(); }
}, 30000);
