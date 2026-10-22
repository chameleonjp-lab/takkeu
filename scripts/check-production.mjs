import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2] ?? 'dist';
const files = [];
function walk(path) { for (const entry of readdirSync(path, { withFileTypes: true })) { const file = join(path, entry.name); if (entry.isDirectory()) walk(file); else files.push(file); } }
walk(dir);
for (const file of files) {
  const name = relative(dir, file);
  if (!/^(index\.html|release\.json|assets\/[\w.-]+\.(js|css))$/.test(name)) throw new Error(`unexpected distribution file: ${name}`);
  const text = readFileSync(file, 'utf8');
  if (/tests\/fixtures|tests\/helpers|window\.stage[23]|setScore|scoreOverride|@vite\/client|playwright|\/src\/main\.ts/.test(text)) throw new Error(`development code in distribution: ${name}`);
}
const revision = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'));
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision.commit !== actual) throw new Error('distribution revision does not match checkout');
console.log(JSON.stringify({ status: 'passed', commit: actual, base: revision.base, files: files.map(file => relative(dir, file)) }, null, 2));
