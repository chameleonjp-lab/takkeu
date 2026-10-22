import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('npm', ['run', 'build']); run('node', ['scripts/check-production.mjs', 'dist']);
mkdirSync('artifacts', { recursive: true }); rmSync('artifacts/root-dist', { recursive: true, force: true });
cpSync('dist', 'artifacts/root-dist', { recursive: true });
run('npm', ['run', 'build:pages']); run('node', ['scripts/check-production.mjs', 'dist']);
run('npm', ['run', 'test:release']);
