import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareMigrationSql, preparePermissionSql } from '../../scripts/release/prepare-production.mjs';

test('migration preparation is an offline, exact reviewed-payload, single-transaction operation',()=>{
  const sql=prepareMigrationSql();
  assert.match(sql,/BEGIN ISOLATION LEVEL REPEATABLE READ;/);
  assert.match(sql,/current_user <> 'postgres'/);
  assert.match(sql,/20261027032043/);
  assert.match(sql,/INSERT INTO supabase_migrations.schema_migrations/);
  assert.match(sql,/changed existing business rows/);
  assert.match(sql,/COMMIT;\s*$/);
  assert.ok(sql.includes(readFileSync('supabase/migrations/20261027032043_takkeu_hall_of_fame.sql','utf8')));
  assert.doesNotMatch(sql,/CREATE ROLE|ALTER ROLE|REVOKE EXECUTE ON FUNCTION pg_catalog/);
});
test('scoped permission preparation and restore touch only the eight reviewed app functions',()=>{
  const {apply,restore,targets}=preparePermissionSql();
  assert.equal(targets.length,8);assert.equal(new Set(targets.map(t=>t.signature)).size,8);
  for(const sql of [apply,restore]){
    assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
    assert.doesNotMatch(sql,/ALL FUNCTIONS|pg_catalog\.lo_|ALTER DEFAULT PRIVILEGES|DROP ROLE/);
    for(const t of targets)assert.ok(sql.includes(t.signature));
  }
  assert.match(apply,/TO anon, authenticated, service_role/);
  assert.match(restore,/restore.*ACL/i);
});
test('offline preparation works in the real CI sparse layout without docs or credentials',()=>{
  const temp=mkdtempSync(join(tmpdir(),'takkeu-preparation-sparse-'));
  try{
    mkdirSync(join(temp,'scripts'),{recursive:true});cpSync('scripts/release',join(temp,'scripts/release'),{recursive:true});
    mkdirSync(join(temp,'supabase/migrations'),{recursive:true});
    cpSync('supabase/migrations/20261027032043_takkeu_hall_of_fame.sql',join(temp,'supabase/migrations/20261027032043_takkeu_hall_of_fame.sql'));
    const result=spawnSync(process.execPath,['scripts/release/prepare-production.mjs'],{cwd:temp,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/migration-approved-only.sql sha256=/);
  }finally{rmSync(temp,{recursive:true,force:true});}
});
