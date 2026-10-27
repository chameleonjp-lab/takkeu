import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

/** Local, isolated schema only. The shared start definition is a read-only
 * snapshot from 2026-10-27; all score writes in these tests stay in PGlite. */
export async function hallDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync('tests/sql/hall-schema.sql', 'utf8'));
  for (const path of [
    'tests/sql/shared-normalize-name.sql',
    'tests/sql/shared-ranking-start.sql',
    'supabase/migrations/20261027_takkeu_submission_guard.sql',
    'supabase/migrations/20261027_takkeu_rate_limit_refinement.sql',
    'supabase/migrations/20261027_takkeu_final_lost_balls.sql',
    'supabase/migrations/20261027032043_takkeu_hall_of_fame.sql',
  ]) await db.exec(readFileSync(path, 'utf8'));
  return db;
}
