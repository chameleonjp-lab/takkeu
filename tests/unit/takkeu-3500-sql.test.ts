import { expect, it } from 'vitest';
import { hallDatabase } from '../helpers/hallDatabase';

const version = 'takkeu-web-clear-3500-1';
const uid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

it('registers only verified new-rule clears, in stable first-registration order per name', async () => {
  const db = await hallDatabase();
  try {
    const functions = (await db.query<{ proname: string }>(`select proname from pg_proc where proname in
      ('start_takkeu_clear_play_v2','finish_takkeu_clear_play_v2','register_takkeu_hall_v2','get_takkeu_hall_v2')`)).rows;
    expect(functions).toHaveLength(4);
    const start = async (n: number, name = 'Alice', client = version, endpoint = 'start_takkeu_clear_play_v2') =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.${endpoint}($1::uuid,$2,'takkeu',$3) as r`, [uid(n), name, client])).rows[0]!.r;
    const finish = async (play: string, score = 3500, lost = 0, result = 'clear', name = 'Alice') =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.finish_takkeu_clear_play_v2($1::uuid,$2,'takkeu',$3,1,$4,$5,$4,$6) as r`, [play, name, result, score, version, lost])).rows[0]!.r;
    const submit = async (play: string, n: number, name = 'Alice', client = version, score = 3500) => {
      await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,$3,'takkeu',$4,$5)`, [play, uid(n), name, score, client]);
    };
    const register = async (play: string, n: number, name = 'Alice', client = version) =>
      (await db.query<{ r: Record<string, unknown> }>(`select public.register_takkeu_hall_v2($1::uuid,$2::uuid,$3,$4) as r`, [play, uid(n), name, client])).rows[0]!.r;
    const age = async (play: string) => { await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`, [play]); };

    const a = (await start(1)).play_id as string;
    await expect(db.query(`update private.game_play_sessions set takkeu_rules_version=null,takkeu_clear_verified=true where play_id=$1::uuid`, [a])).rejects.toThrow(/takkeu_clear_rules_v1/);
    expect(await start(1)).toMatchObject({ accepted: true, play_id: a, rules_version: 'goal-3500-v1' });
    expect(await finish(a)).toMatchObject({ accepted: false, reason: 'takkeu_score_rate_impossible' });
    await age(a);
    expect(await finish(a, 3499)).toMatchObject({ accepted: false });
    expect(await finish(a, 3501)).toMatchObject({ accepted: false });
    expect(await finish(a, 3500, 100)).toMatchObject({ accepted: false });
    expect(await finish(a, 3500, 0, 'game_over')).toMatchObject({ accepted: false });
    expect(await finish(a)).toMatchObject({ accepted: true, result_type: 'clear', score: 3500, lost_balls: 0 });
    expect(await register(a, 101)).toMatchObject({ accepted: false, reason: 'score_not_submitted' });
    await submit(a, 101);
    const first = await register(a, 101);
    expect(first).toMatchObject({ accepted: true, hall_number: 1, normalized_name: 'Alice', display_name: 'Alice' });
    expect(await register(a, 101)).toEqual(first);
    expect(await register(a, 999)).toMatchObject({ accepted: false });
    expect(await register(a, 101, 'Bob')).toMatchObject({ accepted: false });

    const again = (await start(2, 'Alice')).play_id as string;
    await age(again); expect(await finish(again, 3500, 3, 'clear', 'Alice')).toMatchObject({ accepted: true });
    await submit(again, 102, 'Alice');
    expect(await register(again, 102, 'Alice')).toMatchObject({ accepted: true, hall_number: 1, registered_at: first.registered_at });
    const b = (await start(3, 'Bob')).play_id as string;
    await age(b); expect(await finish(b, 3500, 1, 'clear', 'Bob')).toMatchObject({ accepted: true });
    await submit(b, 103, 'Bob');
    expect(await register(b, 103, 'Bob')).toMatchObject({ accepted: true, hall_number: 2 });

    // A historical >3500 score remains usable and never acquires a hall number.
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
    expect(await finish(bypass, 3500, 0, 'clear', 'Bypass')).toMatchObject({ accepted: false });
    const failed = (await start(6, 'Failed')).play_id as string;
    await age(failed); expect(await finish(failed, 3499, 1, 'game_over', 'Failed')).toMatchObject({ accepted: true });
    await submit(failed, 106, 'Failed', version, 3499);
    expect(await register(failed, 106, 'Failed')).toMatchObject({ accepted: false });
    const oldFinish = (await start(7, 'OldFinish')).play_id as string;
    await age(oldFinish);
    await db.query(`select public.finish_takkeu_play_v2($1::uuid,'OldFinish','takkeu','clear',1,3500,$2,3500,0)`, [oldFinish, version]);
    await expect(submit(oldFinish, 107, 'OldFinish')).rejects.toThrow(/verified 3500/);
    expect(await register(oldFinish, 107, 'OldFinish')).toMatchObject({ accepted: false, reason: 'verified_clear_required' });

    await db.exec(`update public.game_scores set ranking_status='hidden' where normalized_name='Alice'; set role anon;`);
    expect((await db.query<{ hall_number: number }>(`select hall_number from public.get_takkeu_hall_v2(30)`)).rows).toEqual([{ hall_number: 2 }]);
    expect(await register(a, 101)).toMatchObject({ accepted: false, reason: 'hall_ineligible' });
    await expect(db.query('select * from public.takkeu_hall_of_fame_3500')).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.takkeu_hall_of_fame_3500(hall_number,normalized_name,display_name,first_play_id) values (999,'fake','Fake',gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from private.takkeu_hall_counter_3500_v1')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
    expect((await db.query<{ n: number }>('select count(*)::integer as n from public.takkeu_hall_of_fame_3500')).rows[0]!.n).toBe(2);
  } finally { await db.close(); }
}, 35000);

it('enforces the3500 contract even through generic RPCs and leaves old3000 ledger independent',async()=>{
 const db=await hallDatabase();
 try{
  const start=async(n:number,version:string,rpc:string)=>(await db.query<{r:{play_id:string}}>(`select public.${rpc}($1::uuid,'Guard','takkeu',$2) r`,[uid(n),version])).rows[0]!.r.play_id;
  const p=await start(501,version,'start_takkeu_clear_play_v2');await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`,[p]);
  for(const [score,result]of [[3000,'clear'],[3499,'clear'],[3501,'game_over']] as const){
   await expect(db.query(`select public.finish_game_play_v1($1::uuid,'Guard','takkeu',$2,1,$3,$4,$3)`,[p,result,score,version])).rejects.toThrow(/invalid 3500/);
  }
  const oldVersion='takkeu-web-clear-1',old=await start(502,oldVersion,'start_takkeu_clear_play_v1');await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`,[old]);
  await db.query(`select public.finish_takkeu_clear_play_v1($1::uuid,'Guard','takkeu','clear',1,3000,$2,3000,0)`,[old,oldVersion]);
  await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'Guard','takkeu',3000,$3)`,[old,uid(503),oldVersion]);
  const receipt=(await db.query<{r:{hall_number:number}}>(`select public.register_takkeu_hall_v1($1::uuid,$2::uuid,'Guard',$3) r`,[old,uid(503),oldVersion])).rows[0]!.r;expect(receipt.hall_number).toBe(1);
  expect((await db.query<{n:number}>('select count(*)::integer n from public.takkeu_hall_of_fame_3500')).rows[0]!.n).toBe(0);
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);for(const table of ['public.takkeu_hall_of_fame_3500','private.takkeu_hall_counter_3500_v1'])await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);await db.exec('reset role');
  }
  expect((await db.query<{score_max:number}>(`select score_max from public.games where game_slug='takkeu'`)).rows[0]!.score_max).toBe(100000000);
 }finally{await db.close();}
},30000);

it('keeps a legacy4001 best and first score when the same name clears3500',async()=>{
 const db=await hallDatabase();
 try{
  for(const [n,client,rpc,score]of [[601,'takkeu-web-ranking-1','start_game_play_v1',4001],[602,version,'start_takkeu_clear_play_v2',3500]] as const){
   const p=(await db.query<{r:{play_id:string}}>(`select public.${rpc}($1::uuid,'Preserve','takkeu',$2) r`,[uid(n),client])).rows[0]!.r.play_id;
   await db.query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id=$1::uuid`,[p]);
   await db.query(`select public.${score===3500?'finish_takkeu_clear_play_v2':'finish_takkeu_play_v2'}($1::uuid,'Preserve','takkeu',$2,1,$3,$4,$3,1)`,[p,score===3500?'clear':'game_over',score,client]);
   await db.query(`select * from public.submit_score_idempotent_v1($1::uuid,$2::uuid,'Preserve','takkeu',$3,$4)`,[p,uid(n+10),score,client]);
  }
  expect((await db.query(`select first_score,best_score,ranking_status from public.game_scores where normalized_name='Preserve'`)).rows).toEqual([{first_score:4001,best_score:4001,ranking_status:'normal'}]);
  for(const role of ['anon','authenticated']){
   const rows=(await db.query<{proname:string;allowed:boolean;public_allowed:boolean}>(`select p.proname,has_function_privilege($1,p.oid,'execute') allowed,exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') public_allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('start_takkeu_clear_play_v2','finish_takkeu_clear_play_v2','register_takkeu_hall_v2','get_takkeu_hall_v2')`,[role])).rows;
   expect(rows).toHaveLength(4);expect(rows.every(r=>r.allowed&&!r.public_allowed)).toBe(true);
  }
 }finally{await db.close();}
},30000);
