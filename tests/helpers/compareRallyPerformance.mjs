import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Usage: node tests/helpers/compareRallyPerformance.mjs BEFORE AFTER OUTPUT [CONTROL]
// CONTROL replaces corresponding comparison rows only; original rows remain in
// their complete raw reports and are explicitly listed below.
const [beforeArgument, afterArgument, outputArgument, controlArgument] = process.argv.slice(2);
if (!beforeArgument || !afterArgument || !outputArgument) throw new Error('Expected BEFORE AFTER OUTPUT [CONTROL]');
const read = path => JSON.parse(readFileSync(resolve(path), 'utf8'));
const before = read(beforeArgument), after = read(afterArgument), control = controlArgument ? read(controlArgument) : null;
const key = row => `${row.project}:${row.quality}:${row.initialScore}:${row.repeat}`;
const baselineRows = new Map(before.rows.map(row => [key(row), row]));
const supersededComparisonRows = [];
for (const row of control?.rows ?? []) {
  const previous = baselineRows.get(key(row));
  if (previous) supersededComparisonRows.push({ condition: key(row), reason: 'Clean control rerun after first baseline attempt overlapped full-unit retry.', original: previous, replacement: row });
  baselineRows.set(key(row), row);
}
const afterRows = new Map(after.rows.map(row => [key(row), row]));
const conditions = [...new Set([...baselineRows.keys(), ...afterRows.keys()])].sort();
const fields = ['p95Ms', 'fractionAtMost25ms', 'runningP95Ms', 'runningFractionAtMost25ms', 'runningSimulationSeconds',
  'durationMs', 'initialHeapBytes', 'finalHeapBytes', 'peakHeapBytes'];
const rows = conditions.map(condition => {
  const pre = baselineRows.get(condition), post = afterRows.get(condition), delta = {};
  for (const field of fields) delta[field] = typeof pre?.[field] === 'number' && typeof post?.[field] === 'number' ? post[field] - pre[field] : null;
  const resourceDelta = {};
  for (const field of new Set([...Object.keys(pre?.maximumResources ?? {}), ...Object.keys(post?.maximumResources ?? {})])) {
    const first = pre?.maximumResources?.[field], last = post?.maximumResources?.[field];
    resourceDelta[field] = typeof first === 'number' && typeof last === 'number' ? last - first : null;
  }
  return { condition, before: pre ?? null, after: post ?? null, delta, maximumResourceDelta: resourceDelta,
    comparisonVerdict: !pre || !post ? 'missing measurement' : pre.executionStatus !== 'passed' || post.executionStatus !== 'passed' ? 'test execution failed' :
      !pre.continuousRun || !post.continuousRun ? 'measured interrupted runs; sustained-play performance target not established' :
      post.required30BallLinuxTarget !== 'met' ? 'after Linux reference target NOT met' : 'after Linux reference target met; target hardware unverified' };
});
const result = { schema: 'rally-4000-before-after-v1', browser: 'chromium', expectedConditions: 16, count: rows.length,
  beforeReport: resolve(beforeArgument), afterReport: resolve(afterArgument), controlReport: controlArgument ? resolve(controlArgument) : null,
  sourceReportErrors: { before: before.reportErrors, after: after.reportErrors, control: control?.reportErrors ?? [] },
  beforePassingExecutions: [...baselineRows.values()].filter(row => row.executionStatus === 'passed').length,
  afterPassingExecutions: after.rows.filter(row => row.executionStatus === 'passed').length,
  beforeMetLinuxReferenceTargets: [...baselineRows.values()].filter(row => row.required30BallLinuxTarget === 'met').length,
  afterMetLinuxReferenceTargets: after.rows.filter(row => row.required30BallLinuxTarget === 'met').length,
  targetHardwareVerdict: 'unverified; no actual iPhone/Safari performance measurement',
  interpretation: 'Idle RAF intervals after a slow-frame pause do not establish gameplay performance. Running-only p95 and ratios are reported alongside continuous simulation time and phase.',
  supersededComparisonRows, rows };
const output = resolve(outputArgument); mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, count: result.count, beforePassingExecutions: result.beforePassingExecutions,
  afterPassingExecutions: result.afterPassingExecutions, beforeMetLinuxReferenceTargets: result.beforeMetLinuxReferenceTargets,
  afterMetLinuxReferenceTargets: result.afterMetLinuxReferenceTargets }, null, 2));
