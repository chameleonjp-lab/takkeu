// Extract raw per-frame attachments and a compact comparison from real reports.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
const dir = new URL('.', import.meta.url).pathname;
const summaries=[];
for (const [label,file] of [['before-chromium','performance-before-chromium-and-deps.json'],['before-webkit','performance-before-webkit.json'],['after','performance-after.json']]) {
  let report; try { report=JSON.parse(readFileSync(join(dir,file),'utf8')); } catch { continue; }
  function visit(suite) {
    for (const spec of suite.specs??[]) for (const test of spec.tests??[]) for (const result of test.results??[]) {
      if (label === 'before-webkit' && test.projectName !== 'webkit') continue;
      for (const attachment of result.attachments??[]) {
        if (!attachment.name.startsWith('browser-performance-60s-')||attachment.contentType!=='application/json')continue;
        const raw=attachment.body?Buffer.from(attachment.body,'base64'):readFileSync(attachment.path);
        const row=JSON.parse(raw.toString()); const filename=`${label}-${test.projectName}-${basename(attachment.name)}`;
        mkdirSync(join(dir,'performance-data'),{recursive:true});writeFileSync(join(dir,'performance-data',filename),raw);
        const { intervals, samples, runningIntervals, ...compact } = row;
        summaries.push({label,project:test.projectName,status:result.status,commandExit:report.stats.unexpected?1:0,raw:`performance-data/${filename}`,...compact});
      }
    }
    for (const child of suite.suites??[]) visit(child);
  }
  for(const suite of report.suites??[])visit(suite);
}
writeFileSync(join(dir,'performance-summary.json'),JSON.stringify(summaries,null,2)+'\n');
console.log(summaries.map(r=>({label:r.label,project:r.project,quality:r.quality,score:r.initialScore,wall:r.durationMs,sim:r.runningSimulationSeconds,p95:r.p95Ms,pause:r.pauseReason,hits:r.opponentHits,peakSources:r.audioResources?.peakSources,verdict:r.measurementVerdict})));
