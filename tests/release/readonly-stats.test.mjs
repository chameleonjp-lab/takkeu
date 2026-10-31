import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {digest} from '../../scripts/release/guards.mjs';
import {currentDatabaseContract} from '../../scripts/release/current-database-contract.mjs';
const observed=JSON.parse(readFileSync('scripts/release/reviewed-stats-20261031.json','utf8'));
test('reviewed statistics update only adds other games guest counts and preserves Takkeu',async()=>{
  const arms="\n    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, ''))) = 'iroate'\n      then (select count(*) from private.iroate_guest_plays_v1)\n    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, ''))) = 'ironarabe'\n      then (select count(*) from private.ironarabe_guest_plays_v1)";
  assert.equal(digest(observed.before),'d083787df63a80c74a829c070405322d609332bbaac3b15d3182705d755d505f');
  assert.equal(observed.before.replace(' else 0::bigint end,',arms+' else 0::bigint end,'),observed.after);
  for(const path of ['scripts/release/production-baseline.json','scripts/release/expected-contract.json']){
    const pinned=JSON.parse(readFileSync(path,'utf8')).readonly_routines.find(r=>r.name==='get_game_play_stats');
    assert.deepEqual(pinned,{...observed.metadata,body:digest(observed.before)});
  }
  const current=currentDatabaseContract();
  assert.deepEqual(current.readonly_routines.find(r=>r.name==='get_game_play_stats'),{...observed.metadata,body:digest(observed.after)});
  const original=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
  current.readonly_routines.find(r=>r.name==='get_game_play_stats').body=digest(observed.before);
  assert.deepEqual(current,original,'every other contract field remains exactly pinned');
  const db=new PGlite();
  try{
    await db.exec(`create schema private;
      create table private.takkeu_guest_plays_v1(id integer);
      create table private.iroate_guest_plays_v1(id integer);
      create table private.ironarabe_guest_plays_v1(id integer);
      insert into private.takkeu_guest_plays_v1 values(1),(2);
      insert into private.iroate_guest_plays_v1 values(1),(2),(3);
      insert into private.ironarabe_guest_plays_v1 values(1),(2),(3),(4),(5);
      create function private.get_game_player_counts_v1(text) returns table(play_count integer)
        language sql as $$values(10),(20)$$;`);
    const install=body=>db.exec(`create or replace function public.get_game_play_stats(p_game_slug text)
      returns table(total_play_count bigint,player_count bigint) language sql stable set search_path='' as $body$${body}$body$;`);
    const read=async slug=>(await db.query('select * from public.get_game_play_stats($1)',[slug])).rows[0];
    await install(observed.before);
    const before=await read('takkeu');assert.deepEqual(before,{total_play_count:32,player_count:2});
    await install(observed.after);
    assert.deepEqual(await read('takkeu'),before);
    assert.deepEqual(await read(' TAKKEU '),before);
    assert.deepEqual(await read('iroate'),{total_play_count:33,player_count:2});
    assert.deepEqual(await read('ironarabe'),{total_play_count:35,player_count:2});
    assert.deepEqual(await read('other'),{total_play_count:30,player_count:2});
  } finally {await db.close();}
});
