import { execFileSync } from 'node:child_process';

const [expected, ref, main] = process.argv.slice(2);
try {
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(expected ?? '')) throw new Error('expected_sha must be a full lowercase commit SHA');
  if (ref !== 'refs/heads/main') throw new Error('select the main branch for manual deployment');
  if (expected !== actual || expected !== main) throw new Error(`revision mismatch: expected=${expected} checkout=${actual} main=${main}`);
  console.log(JSON.stringify({ expected_sha: expected, checkout_sha: actual, main_sha: main, result: 'matched' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
