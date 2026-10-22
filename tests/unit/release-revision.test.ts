import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('公開の照合は完全SHA・main選択・checkout・最新mainの全一致だけを許す', () => {
  const dir = mkdtempSync(join(tmpdir(), 'takkeu-release-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Verification'); git('config', 'user.email', 'verification@example.invalid');
    writeFileSync(join(dir, 'sample'), 'verified'); git('add', '.'); git('commit', '-m', 'fixture');
    const sha = git('rev-parse', 'HEAD'), script = resolve('scripts/check-release-revision.mjs');
    const check = (expected: string, ref: string, main: string) => spawnSync(process.execPath, [script, expected, ref, main], { cwd: dir, encoding: 'utf8' });
    const matched = check(sha, 'refs/heads/main', sha);
    expect({ status: matched.status, stdout: matched.stdout, stderr: matched.stderr, expected: sha }).toEqual({ status: 0, stdout: expect.any(String), stderr: '', expected: expect.stringMatching(/^[0-9a-f]{40}$/) });
    expect(check(sha.slice(0, 7), 'refs/heads/main', sha).status).toBe(1);
    expect(check(sha, 'refs/heads/feature', sha).status).toBe(1);
    expect(check('0'.repeat(40), 'refs/heads/main', sha).status).toBe(1);
    expect(check(sha, 'refs/heads/main', '0'.repeat(40)).status).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
