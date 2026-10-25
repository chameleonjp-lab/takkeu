import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('runs the migration in PostgreSQL: ties, all ranks, eligibility, totals, bests and public privileges', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.game_scores(normalized_name text, game_slug text, best_score integer not null, first_score integer, ranking_status text, primary key(normalized_name,game_slug));
      alter table public.game_scores enable row level security;
      create function public.normalize_player_name(input_name text) returns text language sql immutable as $$ select btrim(coalesce(input_name,'')); $$;
    `);
    await db.exec(readFileSync('supabase/migrations/20261025184307_takkeu_result_position.sql', 'utf8'));
    const get = async (name: string) => (await db.query('select * from public.get_takkeu_player_position_v1($1)', [name])).rows;
    expect(await get('absent')).toEqual([]);
    await db.exec(`insert into game_scores values ('A','takkeu',1000,10,'normal'),('B','takkeu',1000,1000,'normal'),('C','takkeu',900,5,'normal');`);
    expect(await get('A')).toEqual([{ rank_no: 1, total_entries: 3, best_score: 1000 }]);
    expect(await get('B')).toEqual([{ rank_no: 1, total_entries: 3, best_score: 1000 }]);
    expect(await get(' C ')).toEqual([{ rank_no: 3, total_entries: 3, best_score: 900 }]);
    await db.exec(`insert into game_scores values ('excluded','takkeu',9999,1,'excluded'),('unplayed','takkeu',9998,null,'normal'),('other','other',9999,1,'normal'),('legacy','takkeu',0,0,null);`);
    expect(await get('excluded')).toEqual([]); expect(await get('unplayed')).toEqual([]); expect(await get('other')).toEqual([]);
    expect(await get('A')).toEqual([{ rank_no: 1, total_entries: 4, best_score: 1000 }]);
    await db.exec(`insert into game_scores select 'p'||i,'takkeu',800-i,0,'normal' from generate_series(1,150) as i;`);
    expect(await get('p150')).toEqual([{ rank_no: 153, total_entries: 154, best_score: 650 }]);
    await db.exec(`update game_scores set best_score=1100 where normalized_name='C';`);
    expect(await get('C')).toEqual([{ rank_no: 1, total_entries: 154, best_score: 1100 }]);
    expect(await get('A')).toEqual([{ rank_no: 2, total_entries: 154, best_score: 1000 }]);
    await db.exec(`delete from game_scores where normalized_name='p1';`);
    expect(await get('p150')).toEqual([{ rank_no: 152, total_entries: 153, best_score: 650 }]);
    await db.exec('set role anon;');
    expect(await get('C')).toEqual([{ rank_no: 1, total_entries: 153, best_score: 1100 }]);
    await expect(db.query('select * from game_scores')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
    expect((await db.query(`select has_function_privilege('anon','public.get_takkeu_player_position_v1(text)','execute') as anon_allowed, has_function_privilege('public','public.get_takkeu_player_position_v1(text)','execute') as public_allowed;`)).rows).toEqual([{ anon_allowed: true, public_allowed: false }]);
  } finally { await db.close(); }
}, 30000);
