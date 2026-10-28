import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { summarizeCatalog, digest } from '../../scripts/release/guards.mjs';

// Offline construction only. The base is a read-only production catalog snapshot
// (definitions, no player data); additions come from the reviewed local SQL.
export async function buildContract() {
  const base=JSON.parse(readFileSync('scripts/release/production-baseline.json','utf8'));
  const db=new PGlite();
  try {
    for (const file of ['tests/sql/hall-schema.sql','tests/sql/shared-normalize-name.sql','tests/sql/shared-ranking-start.sql',
      'supabase/migrations/20261027_takkeu_submission_guard.sql','supabase/migrations/20261027_takkeu_rate_limit_refinement.sql',
      'supabase/migrations/20261027_takkeu_final_lost_balls.sql']) await db.exec(readFileSync(file,'utf8'));
    await db.exec(`alter default privileges for role postgres in schema public grant truncate,references,trigger,maintain on tables to service_role;
      create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text);
      insert into supabase_migrations.schema_migrations values ('20261027032043','takkeu_hall_of_fame');`);
    const migration_file='supabase/migrations/20261027032043_takkeu_hall_of_fame.sql';
    await db.exec(readFileSync(migration_file,'utf8'));
    const results=await db.exec(readFileSync('scripts/release/catalog.sql','utf8'));
    const local=summarizeCatalog(results.find(r=>r.rows.length)?.rows[0].jsonb_build_object);
    const newFunctions=new Set(['enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1',
      'start_takkeu_clear_play_v1','start_takkeu_clear_play_v2','finish_takkeu_clear_play_v1','finish_takkeu_clear_play_v2',
      'register_takkeu_hall_v1','register_takkeu_hall_v2','get_takkeu_hall_v1','get_takkeu_hall_v2']);
    base.functions.push(...local.functions.filter(f=>newFunctions.has(f.name)));
    for(const table of local.tables) {
      const existing=base.tables.find(t=>t.schema===table.schema&&t.name===table.name);
      if(!existing) base.tables.push(table);
      else {
        if(table.name==='game_play_sessions') {
          existing.columns.push(...table.columns.filter(c=>['takkeu_rules_version','takkeu_clear_verified'].includes(c.name)));
          existing.columns.sort((a,b)=>a.name.localeCompare(b.name));
          existing.constraints.push(...table.constraints.filter(c=>c.name==='takkeu_clear_rules_v1'));
          existing.constraints.sort((a,b)=>a.name.localeCompare(b.name));
        }
        existing.triggers.push(...table.triggers.filter(t=>t.name.startsWith('enforce_takkeu_3500_')));
        existing.triggers.sort((a,b)=>a.name.localeCompare(b.name));
      }
    }
    base.tables.sort((a,b)=>`${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`));
    base.functions.sort((a,b)=>`${a.schema}.${a.name}.${a.args}`.localeCompare(`${b.schema}.${b.name}.${b.args}`));
    return {...base,migration_file,migration_sha256:digest(readFileSync(migration_file,'utf8')),migrations:local.migrations};
  } finally {await db.close();}
}
