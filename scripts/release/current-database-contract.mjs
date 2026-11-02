import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {digest} from './guards.mjs';

// The original snapshot is also used to reproduce previously reviewed SQL.
// Keep it immutable; describe the separately reviewed statistics update here.
export function currentDatabaseContract() {
  const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
  const update=JSON.parse(readFileSync('scripts/release/reviewed-stats-20261031.json','utf8'));
  const entry=contract.readonly_routines.find(r=>r.schema==='public'&&r.name==='get_game_play_stats'&&r.args==='p_game_slug text');
  if(!entry||!isDeepStrictEqual(entry,{...update.metadata,body:digest(update.before)}))
    throw Error('Reviewed statistics update precondition does not match');
  entry.body=digest(update.after);
  return contract;
}
