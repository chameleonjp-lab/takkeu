import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const migration = 'supabase/migrations/20261027_takkeu_submission_guard.sql';
const started = '22222222-2222-4222-8222-222222222222';
const submitted = '33333333-3333-4333-8333-333333333333';
const version = 'takkeu-web-ranking-1';

it('rejects impossible Takkeu time rates, mismatched scores and legacy bypasses', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
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
    await db.exec(readFileSync(migration, 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261027_takkeu_rate_limit_refinement.sql', 'utf8'));
    async function finish(score: number, rankingScore: number) {
      const res = await db.query<{ result: unknown }>(
        "select public.finish_game_play_v1($1::uuid,'tester','takkeu','game_over',1,$2,$3,$4) as result",
        [started,score,version,rankingScore]
      );
      const result = res.rows[0]?.result;
      return typeof result === 'string' ? JSON.parse(result) : result;
    }
    expect(7927).toBeGreaterThan(35 * 216.31 + 150);
    expect(11354).toBeLessThan(35 * 691.15 + 150);
    expect(await finish(999999,999999)).toMatchObject({
      accepted: false, reason: 'takkeu_score_rate_impossible'
    });
    expect(await finish(42,40)).toMatchObject({
      accepted: false, reason: 'takkeu_ranking_score_mismatch'
    });
    expect(await finish(42,42)).toMatchObject({ accepted: true, score: 42 });
    await expect(db.query(
      "select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'tester','takkeu',43,$3)",
      [started,submitted,version]
    )).rejects.toThrow(/does not match submitted score/);
    const correct = await db.query<{ accepted: boolean; result_best_score: number }>(
      "select accepted,result_best_score from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'tester','takkeu',42,$3)",
      [started,submitted,version]
    );
    expect(correct.rows[0]).toMatchObject({ accepted: true, result_best_score: 42 });
    await expect(db.query("select * from public.submit_score('tester','takkeu',100,'old')"))
      .rejects.toThrow(/takkeu requires submit_score_idempotent_v1/);
    const legacyOther = await db.query<{ accepted: boolean }>(
      "select accepted from public.submit_score('tester','other',5,'old')"
    );
    expect(legacyOther.rows[0]?.accepted).toBe(true);
    const stored = await db.query<{ score: number; metadata: { contract_version: string } }>(
      "select score,metadata from public.score_runs where game_slug='takkeu'"
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.score).toBe(42);
    expect(stored.rows[0]?.metadata).toMatchObject({ contract_version: 'ranking-submission-v1' });
  } finally { await db.close(); }
}, 30000);
