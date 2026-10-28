import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { hallDatabase } from '../helpers/hallDatabase';

const migration = readFileSync('supabase/migrations/20261027032043_takkeu_hall_of_fame.sql', 'utf8');
const uid = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const hallTables = ['takkeu_hall_of_fame', 'takkeu_hall_of_fame_3500', 'takkeu_hall_counter_v1', 'takkeu_hall_counter_3500_v1'];
const hallFunctions = [
  'start_takkeu_clear_play_v1', 'finish_takkeu_clear_play_v1', 'register_takkeu_hall_v1', 'get_takkeu_hall_v1',
  'start_takkeu_clear_play_v2', 'finish_takkeu_clear_play_v2', 'register_takkeu_hall_v2', 'get_takkeu_hall_v2',
  'enforce_takkeu_3500_result_v1', 'enforce_takkeu_3500_score_v1',
];

/** Disposable PostgreSQL only; this never reads a connection string or uses HTTP. */
async function beforeHallDatabase() {
  const db = new PGlite();
  for (const path of [
    'tests/sql/hall-schema.sql',
    'tests/sql/shared-normalize-name.sql',
    'tests/sql/shared-ranking-start.sql',
    'supabase/migrations/20261027_takkeu_submission_guard.sql',
    'supabase/migrations/20261027_takkeu_rate_limit_refinement.sql',
    'supabase/migrations/20261027_takkeu_final_lost_balls.sql',
  ]) await db.exec(readFileSync(path, 'utf8'));
  return db;
}

async function inventory(db: PGlite) {
  return (await db.query(`select
    (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and c.relkind='r' and c.relname=any($1::text[])) as tables,
    (select count(*)::integer from information_schema.columns where table_schema='private'
      and table_name='game_play_sessions' and column_name in ('takkeu_rules_version','takkeu_clear_verified')) as columns,
    (select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.proname=any($2::text[])) as functions,
    (select count(*)::integer from pg_trigger where not tgisinternal
      and tgname in ('enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1')) as triggers,
    (select count(*)::integer from pg_constraint k join pg_class c on c.oid=k.conrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
      and k.contype <> 'n'
      and (c.relname=any($1::text[]) or (c.relname='game_play_sessions' and k.conname='takkeu_clear_rules_v1'))) as constraints,
    (select count(*)::integer from pg_index i join pg_class c on c.oid=i.indrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
      and c.relname=any($1::text[])) as indexes`, [hallTables, hallFunctions])).rows[0];
}

async function existingData(db: PGlite) {
  const result: Record<string, unknown> = {};
  for (const [table, order] of [
    ['public.games', 'game_slug'], ['public.players', 'normalized_name'],
    ['public.game_scores', 'normalized_name,game_slug'], ['public.score_runs', 'id'],
    ['private.game_play_sessions', 'play_id'],
  ]) {
    result[table!] = (await db.query(`select to_jsonb(t) - 'takkeu_rules_version' - 'takkeu_clear_verified' as row
      from ${table} t order by ${order}`)).rows;
  }
  return result;
}

async function seedLegacyScore(db: PGlite) {
  const play = (await db.query<{ r: { play_id: string } }>(
    `select public.start_game_play_v1($1::uuid,'Existing','takkeu','takkeu-web-ranking-1') as r`, [uid(1)],
  )).rows[0]!.r.play_id;
  await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`, [play]);
  await db.query(`select public.finish_takkeu_play_v2($1::uuid,'Existing','takkeu','game_over',1,4001,'takkeu-web-ranking-1',4001,1)`, [play]);
  await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'Existing','takkeu',4001,'takkeu-web-ranking-1')`, [play, uid(2)]);
  await db.exec(`update public.game_scores set ranking_status='provisional_bot' where normalized_name='Existing'`);
}

const applied = { tables: 4, columns: 2, functions: 10, triggers: 2, constraints: 21, indexes: 8 };
const absent = { tables: 0, columns: 0, functions: 0, triggers: 0, constraints: 0, indexes: 0 };

it('rolls back every migration object and preserves existing scores after a late transaction failure', async () => {
  const db = await beforeHallDatabase();
  try {
    await seedLegacyScore(db);
    const before = await existingData(db);
    await db.exec('begin');
    await db.exec(migration);
    expect(await inventory(db)).toEqual(applied);
    expect(await existingData(db)).toEqual(before);
    expect((await db.query(`select takkeu_rules_version,takkeu_clear_verified from private.game_play_sessions`)).rows)
      .toEqual([{ takkeu_rules_version: null, takkeu_clear_verified: false }]);
    expect((await db.query(`select next_number from private.takkeu_hall_counter_v1
      union all select next_number from private.takkeu_hall_counter_3500_v1`)).rows)
      .toEqual([{ next_number: 1 }, { next_number: 1 }]);
    await expect(db.exec('select 1/0')).rejects.toThrow(/division by zero/);
    await db.exec('rollback');
    expect(await inventory(db)).toEqual(absent);
    expect(await existingData(db)).toEqual(before);
  } finally { await db.close(); }
}, 30000);

it('requires a clean preflight and preserves a committed schema when a duplicate apply is rolled back', async () => {
  const db = await beforeHallDatabase();
  try {
    await seedLegacyScore(db);
    const before = await existingData(db);
    // A late object collision must undo even the successfully executed prefix.
    await db.exec(`create function private.enforce_takkeu_3500_score_v1() returns trigger
      language plpgsql as $$begin return new; end;$$;`);
    await db.exec('begin');
    await expect(db.exec(migration)).rejects.toThrow(/already exists/);
    await db.exec('rollback');
    expect(await inventory(db)).toEqual({ ...absent, functions: 1 });
    expect(await existingData(db)).toEqual(before);
    await db.exec('drop function private.enforce_takkeu_3500_score_v1()');
    await db.exec('begin');
    await db.exec(migration);
    await db.exec('commit');
    expect(await inventory(db)).toEqual(applied);
    const after = await existingData(db);
    expect(after).toEqual(before);
    await db.exec('begin');
    await expect(db.exec(migration)).rejects.toThrow(/already exists/);
    await db.exec('rollback');
    expect(await inventory(db)).toEqual(applied);
    expect(await existingData(db)).toEqual(after);
  } finally { await db.close(); }
}, 30000);

it('rolls back a hall registration and its counter together without rolling back an earlier score commit', async () => {
  const db = await hallDatabase();
  const client = 'takkeu-web-clear-3500-1';
  try {
    const play = (await db.query<{ r: { play_id: string } }>(
      `select public.start_takkeu_clear_play_v2($1::uuid,'Rollback','takkeu',$2) as r`, [uid(3), client],
    )).rows[0]!.r.play_id;
    await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`, [play]);
    await db.query(`select public.finish_takkeu_clear_play_v2($1::uuid,'Rollback','takkeu','clear',1,3500,$2,3500,0)`, [play, client]);
    await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'Rollback','takkeu',3500,$3)`, [play, uid(4), client]);
    const register = async () => (await db.query<{ r: Record<string, unknown> }>(
      `select public.register_takkeu_hall_v2($1::uuid,$2::uuid,'Rollback',$3) as r`, [play, uid(4), client],
    )).rows[0]!.r;
    const state = async () => (await db.query(`select
      (select count(*)::integer from public.takkeu_hall_of_fame_3500) as entries,
      (select next_number from private.takkeu_hall_counter_3500_v1 where singleton) as next_number,
      (select count(*)::integer from public.score_runs where play_id=$1::uuid) as submitted_scores`, [play])).rows[0];
    await db.exec('begin');
    expect(await register()).toMatchObject({ accepted: true, hall_number: 1 });
    expect(await state()).toEqual({ entries: 1, next_number: 2, submitted_scores: 1 });
    await expect(db.exec('select 1/0')).rejects.toThrow(/division by zero/);
    await db.exec('rollback');
    expect(await state()).toEqual({ entries: 0, next_number: 1, submitted_scores: 1 });
    const receipt = await register();
    expect(receipt).toMatchObject({ accepted: true, hall_number: 1 });
    expect(await register()).toEqual(receipt);
    expect(await state()).toEqual({ entries: 1, next_number: 2, submitted_scores: 1 });
  } finally { await db.close(); }
}, 30000);
