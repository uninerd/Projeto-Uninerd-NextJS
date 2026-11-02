import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { docker } from './release.mjs';
const origin=process.env.TEST_API_ORIGIN ?? 'http://localhost:8080';
const marker=`review-probe-${randomUUID()}`;
const response=await fetch(`${origin}/api/users/${marker}@example.test?private=${marker}`,{signal:AbortSignal.timeout(15000)});
assert.equal(response.status,401);
const requestId=response.headers.get('x-request-id'); assert.ok(requestId);
const body=await response.json(); assert.ok(!JSON.stringify(body).includes(marker));
let log;
for (let attempt=0;attempt<10;attempt++) {
  const lines=docker(['compose','logs','--no-color','--tail','100','backend']).split('\n');
  for (const line of lines) {
    const start=line.indexOf('{'); if(start<0)continue;
    try { const item=JSON.parse(line.slice(start)); if(item.event==='http.request' && item.requestId===requestId)log=item; } catch {}
  }
  if(log)break; await new Promise(resolve=>setTimeout(resolve,250));
}
assert.ok(log,'Correlated request log not found');
assert.equal(log.path,'unmatched'); assert.equal(log.service,'uninerd-backend');
assert.ok(!JSON.stringify(log).includes(marker));
const health=await fetch(`${origin}/api/ready`,{signal:AbortSignal.timeout(15000)});
assert.equal(health.status,200); const readiness=await health.json(); assert.equal(readiness.database,true); assert.equal(readiness.redis,true);
const evidence={timestamp:new Date().toISOString(),origin,scope:'Read-only unauthenticated runtime probe, not a complete integration suite',
  status:response.status,requestId,logPath:log.path,logService:log.service,correlationMatched:true,rawProbeOmitted:true,readiness,passed:true};
mkdirSync('docs/evidencias',{recursive:true});
writeFileSync('docs/evidencias/backend-local.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
