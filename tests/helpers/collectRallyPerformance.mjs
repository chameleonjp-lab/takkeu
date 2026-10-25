import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Preserve every Playwright result (including setup/test failures) and each full
// measurement. Usage: node tests/helpers/collectRallyPerformance.mjs REPORT DEST
const [reportArgument, destinationArgument] = process.argv.slice(2);
if (!reportArgument || !destinationArgument) throw new Error('Expected REPORT DEST');
const reportPath = resolve(reportArgument), destination = resolve(destinationArgument);
const raw = readFileSync(reportPath), report = JSON.parse(raw);
mkdirSync(destination, { recursive: true });
writeFileSync(join(destination, 'playwright-results.json.gz'), gzipSync(raw));
const rows = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
    for (const result of test.results ?? []) {
      const row = { title: spec.title, project: test.projectName, expectedStatus: test.expectedStatus,
        executionStatus: result.status, durationMs: result.duration, retry: result.retry,
        playwrightErrors: result.errors ?? [], attachments: [] };
      for (const attachment of result.attachments ?? []) {
        if (!attachment.name.startsWith('rally4000-') || attachment.contentType !== 'application/json') continue;
        let data;
        if (attachment.body) data = Buffer.from(attachment.body, 'base64');
        else if (attachment.path) {
          const choices = [attachment.path, resolve(dirname(reportPath), attachment.path), resolve(attachment.path)];
          const path = choices.find(candidate => existsSync(candidate));
          if (path) data = readFileSync(path);
        }
        if (!data) { row.attachments.push({ name: attachment.name, status: 'unreadable', original: attachment }); continue; }
        const measurement = JSON.parse(data.toString('utf8'));
        const filename = `${test.projectName}-${attachment.name.replace(/\.json$/, '')}.json.gz`;
        writeFileSync(join(destination, filename), gzipSync(data));
        row.attachments.push({ name: attachment.name, file: filename, status: 'retained' });
        Object.assign(row, Object.fromEntries(Object.entries(measurement).filter(([key]) => !['intervals', 'runningIntervals', 'samples', 'errors'].includes(key))));
        row.pageErrors = measurement.errors;
        row.thirtyBallsThroughout = measurement.initialBalls === 30 && measurement.samples.length > 0 && measurement.samples.every(sample => sample.activeBalls === 30);
        row.required30BallLinuxTarget = measurement.linuxReferenceTarget === 'met' && row.thirtyBallsThroughout ? 'met' : 'NOT met';
        // Keep executionStatus as Playwright's status, not the measurement text.
        row.measurementExecutionStatus = measurement.executionStatus;
        row.executionStatus = result.status;
      }
      rows.push(row);
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites ?? []) visit(suite);
const summary = { schema: 'rally-4000-performance-summary-v1', reportErrors: report.errors ?? [],
  playwrightStats: report.stats, count: rows.length, expectedConditionsPerBrowser: 16,
  measurementCount: rows.filter(row => row.attachments.some(attachment => attachment.status === 'retained')).length,
  passingExecutions: rows.filter(row => row.executionStatus === 'passed').length,
  metLinuxReferenceTargets: rows.filter(row => row.required30BallLinuxTarget === 'met').length,
  unmetLinuxReferenceTargets: rows.filter(row => row.required30BallLinuxTarget === 'NOT met').length,
  targetHardwareVerdict: 'unverified', rows };
writeFileSync(join(destination, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ destination, count: summary.count, measurements: summary.measurementCount,
  passingExecutions: summary.passingExecutions, metLinuxReferenceTargets: summary.metLinuxReferenceTargets,
  unmetLinuxReferenceTargets: summary.unmetLinuxReferenceTargets, reportErrors: summary.reportErrors }, null, 2));
