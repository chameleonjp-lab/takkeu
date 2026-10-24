import { spawnSync, execFileSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [name, command, ...args] = process.argv.slice(2);
if (!name || !command) throw new Error('record-check.mjs <name> <command> [...args]');
const directory = new URL('.', import.meta.url).pathname, path = `${directory}${name}.log`;
const git = (...argv) => execFileSync('git', argv, {encoding:'utf8'}).trim();
const metadata = { command:[command,...args], sha:git('rev-parse','HEAD'),
  sourceTree:git('rev-parse','HEAD:src'), testTree:git('rev-parse','HEAD:tests'),
  productOrTestDirty:spawnSync('git',['diff','--quiet','HEAD','--','src','tests','index.html','package.json','package-lock.json']).status!==0,
  startedAt:new Date().toISOString(), node:process.version,
  environment:'local Linux managed executor; automatic; real Playwright engines, not iPhone hardware',
  browserDependencyValidation:process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS==='1'?'system ldconfig check skipped; official dependencies supplied in browser bundle; engine actually launched':'normal',
};
const output=openSync(path,'w');
const result=spawnSync(command,args,{stdio:['ignore',output,output]});closeSync(output);
Object.assign(metadata,{endedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message,
  logSha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
writeFileSync(`${directory}${name}.json`,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata,null,2));process.exitCode=result.status??1;
