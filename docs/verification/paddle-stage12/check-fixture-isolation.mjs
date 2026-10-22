// Supplement the normal release checks for the fixture added by this change.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const directory = 'docs/verification/paddle-stage12';
const formal = JSON.parse(readFileSync(`${directory}/final-verification.json`, 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(formal.result, 'passed'); assert.equal(formal.commit, commit);
const checks = [], startedAt = new Date().toISOString();
for (const [folder, base, port] of [['artifacts/root-dist', '/', 4179], ['dist', '/takkeu/', 4180]]) {
  const files = readdirSync(`${folder}/assets`).filter(name => name.endsWith('.js'));
  for (const name of files) assert.doesNotMatch(readFileSync(`${folder}/assets/${name}`, 'utf8'), /occlusionHarness|tests\/fixtures\/occlusion|gpu-occlusion|window\.occlusion/);
  const server = spawn('node', ['scripts/serve-built.mjs', folder, base, String(port)], { stdio: 'ignore' });
  try {
    const origin = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(origin + base)).ok) break; } catch { /* starting */ }
      if (i === 99) throw new Error('Built server startup failed');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const release = await (await fetch(origin + base + 'release.json')).json();
    assert.equal(release.commit, commit); assert.equal(release.base, base);
    const paths = {};
    for (const path of ['tests/fixtures/occlusion.html', 'tests/helpers/occlusionHarness.ts']) {
      paths[path] = (await fetch(origin + base + path)).status;
      assert.equal(paths[path], 404);
    }
    checks.push({ folder, base, release, absentBundleTokens: true, paths });
  } finally { server.kill('SIGTERM'); }
}
for (const [path, expected] of Object.entries(formal.distributionSha256)) assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected);
writeFileSync(`${directory}/fixture-isolation.json`, JSON.stringify({commit, startedAt, endedAt:new Date().toISOString(), result:'passed', checks, distributionHashesMatchFormal:true}, null, 2) + '\n');
console.log(JSON.stringify(checks));
