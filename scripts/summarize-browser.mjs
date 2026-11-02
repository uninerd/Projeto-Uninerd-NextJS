import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const report=JSON.parse(readFileSync('test-results/browser-report.json','utf8'));
const tests=[];
function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) tests.push({
    title:spec.title, project:test.projectName, status:test.status,
    durationMs:test.results.reduce((sum,result)=>sum+result.duration,0),
  });
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
assert.ok(tests.length>0,'No browser tests found');
const passed=tests.every(test=>test.status==='expected') && (report.errors?.length ?? 0)===0;
mkdirSync('docs/evidencias',{recursive:true});
writeFileSync('docs/evidencias/navegador-local.json',JSON.stringify({
  timestamp:report.stats.startTime, durationMs:report.stats.duration,
  scope:'Chromium/Edge with synthetic accounts; desktop project uses 1280x900 and mobile project uses viewport 390x844; executed projects listed per result; not physical-device testing',
  passed, tests,
},null,2)+'\n');
if (!passed) process.exitCode=1;
console.log(`${tests.length} browser results; passed=${passed}. Summary excludes credentials, request bodies and traces.`);
