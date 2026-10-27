import { expect, it } from 'vitest';
import { hallDatabase } from '../helpers/hallDatabase';

const version = 'takkeu-web-clear-1';
const uid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

it('registers only verified new-rule clears, in stable first-registration order per name', async () => {
  const db = await hallDatabase();
  try {
    const functions = (await db.query<{ proname: string }>(`select proname from pg_proc where proname in
      ('start_takkeu_clear_play_v1','finish_takkeu_clear_play_v1','register_takkeu_hall_v1','get_takkeu_hall_v1')`)).rows;
    expect(functions).toHaveLength(4);
    const start = async (n: number, name = 'Alice', client = version, endpoint = 'start_takkeu_clear_play_v1') =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.${endpoint}($1::uuid,$2,'takkeu',$3) as r`, [uid(n), name, client])).rows[0]!.r;
    const finish = async (play: string, score = 3000, lost = 0, result = 'clear', name = 'Alice') =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.finish_takkeu_clear_play_v1($1::uuid,$2,'takkeu',$3,1,$4,$5,$4,$6) as r`, [play, name, result, score, version, lost])).rows[0]!.r;
    const submit = async (play: string, n: number, name = 'Alice', client = version, score = 3000) => {
      await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,$3,'takkeu',$4,$5)`, [play, uid(n), name, score, client]);
    };
    const register = async (play: string, n: number, name = 'Alice', client = version) =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.register_takkeu_hall_v1($1::uuid,$2::uuid,$3,$4) as r`, [play, uid(n), name, client])).rows[0]!.r;
    const age = async (play: string) => { await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`, [play]); };

    const a = (await start(1)).play_id as string;
    await expect(db.query(`update private.game_play_sessions set takkeu_rules_version=null,takkeu_clear_verified=true where play_id=$1::uuid`, [a])).rejects.toThrow(/takkeu_clear_rules_v1/);
    expect(await start(1)).toMatchObject({ accepted: true, play_id: a, rules_version: 'goal-3000-v1' });
    expect(await finish(a)).toMatchObject({ accepted: false, reason: 'takkeu_score_rate_impossible' });
    await age(a);
    expect(await finish(a, 2999)).toMatchObject({ accepted: false });
    expect(await finish(a, 3001)).toMatchObject({ accepted: false });
    expect(await finish(a, 3000, 100)).toMatchObject({ accepted: false });
    expect(await finish(a, 3000, 0, 'game_over')).toMatchObject({ accepted: false });
    expect(await finish(a)).toMatchObject({ accepted: true, result_type: 'clear', score: 3000, lost_balls: 0 });
    expect(await register(a, 101)).toMatchObject({ accepted: false, reason: 'score_not_submitted' });
    await submit(a, 101);
    const first = await register(a, 101);
    expect(first).toMatchObject({ accepted: true, hall_number: 1, normalized_name: 'Alice', display_name: 'Alice' });
    expect(await register(a, 101)).toEqual(first);
    expect(await register(a, 999)).toMatchObject({ accepted: false });
    expect(await register(a, 101, 'Bob')).toMatchObject({ accepted: false });

    const again = (await start(2, 'Alice')).play_id as string;
    await age(again); expect(await finish(again, 3000, 3, 'clear', 'Alice')).toMatchObject({ accepted: true });
    await submit(again, 102, 'Alice');
    expect(await register(again, 102, 'Alice')).toMatchObject({ accepted: true, hall_number: 1, registered_at: first.registered_at });
    const b = (await start(3, 'Bob')).play_id as string;
    await age(b); expect(await finish(b, 3000, 1, 'clear', 'Bob')).toMatchObject({ accepted: true });
    await submit(b, 103, 'Bob');
    expect(await register(b, 103, 'Bob')).toMatchObject({ accepted: true, hall_number: 2 });

    // A historical >3000 score remains usable and never acquires a hall number.
    const legacy = (await start(4, 'Old', 'takkeu-web-ranking-1', 'start_game_play_v1')).play_id as string;
    await age(legacy);
    await db.query(`select public.finish_takkeu_play_v2($1::uuid,'Old','takkeu','game_over',1,4001,'takkeu-web-ranking-1',4001,1)`, [legacy]);
    await submit(legacy, 104, 'Old', 'takkeu-web-ranking-1', 4001);
    expect(await register(legacy, 104, 'Old', 'takkeu-web-ranking-1')).toMatchObject({ accepted: false });
    expect(await start(4, 'Old')).toMatchObject({ accepted: false });
    expect((await db.query<{ best_score: number }>(`select best_score from public.game_scores where normalized_name='Old'`)).rows[0]!.best_score).toBe(4001);

    // Even a generic current-version start is not promoted to a new-rule start.
    const bypass = (await start(5, 'Bypass', version, 'start_game_play_v1')).play_id as string;
    expect(await start(5, 'Bypass')).toMatchObject({ accepted: false });
    await age(bypass);
    expect(await finish(bypass, 3000, 0, 'clear', 'Bypass')).toMatchObject({ accepted: false });
    const failed = (await start(6, 'Failed')).play_id as string;
    await age(failed); expect(await finish(failed, 2999, 1, 'game_over', 'Failed')).toMatchObject({ accepted: true });
    await submit(failed, 106, 'Failed', version, 2999);
    expect(await register(failed, 106, 'Failed')).toMatchObject({ accepted: false });
    const oldFinish = (await start(7, 'OldFinish')).play_id as string;
    await age(oldFinish);
    await db.query(`select public.finish_takkeu_play_v2($1::uuid,'OldFinish','takkeu','clear',1,3000,$2,3000,0)`, [oldFinish, version]);
    await submit(oldFinish, 107, 'OldFinish');
    expect(await register(oldFinish, 107, 'OldFinish')).toMatchObject({ accepted: false, reason: 'verified_clear_required' });

    await db.exec(`update public.game_scores set ranking_status='hidden' where normalized_name='Alice'; set role anon;`);
    expect((await db.query<{ hall_number: number }>(`select hall_number from public.get_takkeu_hall_v1(30)`)).rows).toEqual([{ hall_number: 2 }]);
    expect(await register(a, 101)).toMatchObject({ accepted: false, reason: 'hall_ineligible' });
    await expect(db.query('select * from public.takkeu_hall_of_fame')).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.takkeu_hall_of_fame(hall_number,normalized_name,display_name,first_play_id) values (999,'fake','Fake',gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from private.takkeu_hall_counter_v1')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
    expect((await db.query<{ n: number }>('select count(*)::integer as n from public.takkeu_hall_of_fame')).rows[0]!.n).toBe(2);
  } finally { await db.close(); }
}, 30000);
