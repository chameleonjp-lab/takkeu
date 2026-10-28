import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionEnvironment, readCatalog } from '../../scripts/release/database.mjs';
const secret='DO_NOT_LOG_THIS_PASSWORD';
const e={PATH:process.env.PATH,PGHOST:'db.mlpnjgezrnhdxsxolyzj.supabase.co',PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'release_reader',PGPASSWORD:secret};
test('DB connection is project-bound, SSL verified, read-only and has no inherited connection options',()=>{
  const result=connectionEnvironment({...e,PGOPTIONS:'-c default_transaction_read_only=off',PGSERVICE:'evil',PGSSLMODE:'disable'});
  assert.match(result.PGOPTIONS,/default_transaction_read_only=on/);
  assert.equal(result.PGSSLMODE,'verify-full');assert.equal(result.PGSERVICE,undefined);
  for(const change of [{PGHOST:'attacker.invalid'},{PGPASSWORD:''},{PGDATABASE:'other'},{PGPORT:'80'},
    {PGHOST:'aws-0-test.pooler.supabase.com',PGUSER:'release_reader.other'}])assert.throws(()=>connectionEnvironment({...e,...change}));
  assert.doesNotThrow(()=>connectionEnvironment({...e,PGHOST:'aws-0-test.pooler.supabase.com',PGUSER:'release_reader.mlpnjgezrnhdxsxolyzj'}));
});
test('permission, network, timeout and invalid response failures cannot become a successful DB gate',()=>{
  for(const result of [{status:1,stderr:secret},{status:null,signal:'SIGTERM',stderr:secret},
    {status:0,error:Error(secret)},{status:0,stdout:'not JSON'}]) {
    assert.throws(()=>readCatalog(e,()=>result),error=>!error.message.includes(secret));
  }
  let argsSeen;
  assert.deepEqual(readCatalog(e,(_cmd,args,options)=>{argsSeen=args;assert.equal(options.timeout,25000);return {status:0,stdout:'{"ok":true}'};}),{ok:true});
  assert.ok(!argsSeen.join(' ').includes(secret));assert.ok(argsSeen.includes('-X'));assert.ok(argsSeen.includes('ON_ERROR_STOP=1'));
});
