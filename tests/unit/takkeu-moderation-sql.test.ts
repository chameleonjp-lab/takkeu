import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const moderationSQL = 'supabase/migrations/20261027_takkeu_moderation_categories.sql';
const progressSQL = 'supabase/migrations/20261027_takkeu_progress_checks.sql';

it('moves only two known anomalous Takkeu records, preserves them and hides private audit data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
      create role anon; create role authenticated; create role service_role;
      create table public.game_scores(
        normalized_name text not null, game_slug text not null,
        display_name text not null, first_score integer, best_score integer not null,
        play_count integer not null, ranking_status text not null default 'normal',
        ranking_note text, ranking_status_updated_at timestamptz,
        primary key(normalized_name,game_slug)
      );
      insert into public.game_scores
        (normalized_name,game_slug,display_name,first_score,best_score,play_count)
      values
        ('💩','takkeu','💩',1,45773300,4),
        ('あ','takkeu','あ',1,7927,287),
        ('かみ','takkeu','かみ',77,11354,10),
        ('💩','other','💩',1,999,1);
    `);
    await db.exec(readFileSync(moderationSQL, 'utf8'));
    const rows = (await db.query<{ display_name: string; best_score: number; ranking_status: string }>(`select display_name,best_score,ranking_status
      from public.game_scores where game_slug='takkeu' order by best_score desc`)).rows;
    expect(rows.map(row => row.ranking_status)).toEqual(['provisional_bot','normal','provisional_bot']);
    const anomalies = (await db.query<{ display_name: string; best_score: number; ranking_status: string }>('select display_name,best_score,ranking_status from public.get_takkeu_abnormal_entries_v1(50)')).rows;
    expect(anomalies.map(row => row.display_name)).toEqual(['💩','あ']);
    expect((await db.query<{ n: number }>('select count(*)::integer as n from private.takkeu_moderation_audit_v1')).rows[0]?.n).toBe(2);
    expect((await db.query<{ ranking_status: string }>(`select ranking_status from game_scores where game_slug='other'`)).rows[0]?.ranking_status).toBe('normal');
    await db.exec('set role anon;');
    expect((await db.query<{ n: number }>('select count(*)::integer as n from public.get_takkeu_abnormal_entries_v1(50)')).rows[0]?.n).toBe(2);
    await expect(db.query('select * from private.takkeu_moderation_audit_v1')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
  } finally { await db.close(); }
}, 30000);

it('collects high-score progress without treating it as proof of BOT and flags inconsistencies', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
      create role anon; create role authenticated; create role service_role;
      create table private.game_play_sessions(
        play_id uuid primary key,
        game_slug text not null, normalized_name text not null, client_version text not null,
        started_at timestamptz not null, finished_at timestamptz
      );
      create function public.normalize_player_name(input_name text)
      returns text language sql immutable as $$ select btrim(coalesce(input_name,'')); $$;
      insert into private.game_play_sessions(play_id,game_slug,normalized_name,client_version,started_at)
      values ('22222222-2222-4222-8222-222222222222','takkeu','tester','takkeu-web-ranking-1',
        clock_timestamp() - interval '60 seconds');
    `);
    await db.exec(readFileSync(progressSQL, 'utf8'));
    const report = async (score: number, simSeconds: number) => {
      const rows = (await db.query<{ response: unknown }>(`select public.report_takkeu_progress_v1(
        '22222222-2222-4222-8222-222222222222','tester','takkeu-web-ranking-1',$1,$2,30,0) as response`,
        [score, simSeconds])).rows;
      const result = rows[0]?.response;
      return typeof result === 'string' ? JSON.parse(result) : result;
    };
    expect(await report(2000, 50)).toMatchObject({ accepted: true, high_density_signal: true });
    expect(await report(1999, 51)).toMatchObject({ accepted: false, reason: 'non_monotonic' });
    expect(await report(100000, 52)).toMatchObject({ accepted: false, reason: 'invalid_rate' });
    expect((await db.query<{ report_count: number }>('select report_count from private.takkeu_progress_v1')).rows[0]?.report_count).toBe(1);
    expect((await db.query<{ n: number }>('select count(*)::integer as n from private.takkeu_progress_signals_v1')).rows[0]?.n).toBe(3);
    await db.exec('set role anon;');
    await expect(db.query('select * from private.takkeu_progress_v1')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
  } finally { await db.close(); }
}, 30000);
