import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync, mkdirSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'docs/verification/stage3'; mkdirSync(dir, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
const sourcePaths = ['src', 'tests', 'scripts', '.github', 'package.json', 'package-lock.json', '*.config.ts', 'index.html', '.node-version'];
if (git('status', '--porcelain', '--', ...sourcePaths)) throw new Error('Commit source, tests and configuration before formal verification');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sources = Object.fromEntries(git('ls-files', '--', ...sourcePaths).split('\n').filter(Boolean).map(path => [path, hash(path)]));
const record = { commit: sha, startedAt: new Date().toISOString(), environment: { platform: process.platform, node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), browsers: 'Playwright Chromium / WebKit on Linux; not iPhone hardware' }, sourceSha256: sources, steps: [], result: 'running' };
const save = () => writeFileSync(join(dir, 'final-verification.json'), JSON.stringify(record, null, 2) + '\n');
const steps = [
  ['install', 'npm', ['ci', '--cache', '/tmp/takkeu-npm-cache']],
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['unit', 'npm', ['run', 'test:unit', '--', '--reporter=default', '--reporter=json', `--outputFile=${dir}/final-unit.json`]],
  ['browser', 'npm', ['run', 'test:browser']],
  ['distribution', 'npm', ['run', 'verify:release']],
  ['performance', 'npm', ['run', 'test:performance']],
  ['diff', 'git', ['diff', '--check']],
];
save();
for (const [name, command, args] of steps) {
  const path = join(dir, `final-${name}.log`), fd = openSync(path, 'w'), startedAt = new Date().toISOString();
  const result = spawnSync(command, args, { stdio: ['ignore', fd, fd] }); closeSync(fd);
  record.steps.push({ name, command: [command, ...args], startedAt, endedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, log: path, logSha256: hash(path) });
  if (name === 'browser' && existsSync('test-results/results.json')) cpSync('test-results/results.json', join(dir, 'final-browser.json'));
  if (name === 'distribution' && existsSync('artifacts/release-results.json')) cpSync('artifacts/release-results.json', join(dir, 'final-release.json'));
  if (name === 'performance' && existsSync('artifacts/performance-results.json')) cpSync('artifacts/performance-results.json', join(dir, 'final-performance.json'));
  save(); console.log(`${name}: exit ${result.status}; ${path}`);
  if (result.status !== 0) {
    record.result = 'failed'; record.endedAt = new Date().toISOString(); save();
    const attempt = join(dir, 'attempts', record.startedAt.replaceAll(':', '-')); mkdirSync(attempt, { recursive: true });
    for (const file of readdirSync(dir).filter(name => name.startsWith('final-'))) cpSync(join(dir, file), join(attempt, file));
    process.exit(result.status ?? 1);
  }
}
if (git('rev-parse', 'HEAD') !== sha || git('status', '--porcelain', '--', ...sourcePaths) || Object.entries(sources).some(([path, value]) => hash(path) !== value)) throw new Error('Verification source changed');
record.result = 'passed'; record.endedAt = new Date().toISOString();
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]); }
record.distributionSha256 = Object.fromEntries([...files('dist'), ...files('artifacts/root-dist')].map(path => [path, hash(path)]));
save();
