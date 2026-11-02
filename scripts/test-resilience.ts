import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// Local, sequential fault drill. Run only against the disposable/development Compose stack.
const origin = process.env.TEST_API_ORIGIN ?? 'http://localhost:8080';
const dockerArgs = process.env.DOCKER_CONTEXT ? ['--context', process.env.DOCKER_CONTEXT] : [];
const compose = (...args: string[]) => execFileSync('docker', [...dockerArgs, 'compose', ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let cookie = '';
async function request(path: string, expected: number) {
  const start = performance.now();
  const response = await fetch(`${origin}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  assert.equal(response.status, expected, `${path}: expected ${expected}, got ${response.status}`);
  return { durationMs: Math.round((performance.now()-start)*100)/100, text };
}
async function until(check: () => Promise<void>) {
  const deadline = Date.now()+60000;
  while (true) {
    try { await check(); return; } catch (error) {
      if (Date.now() >= deadline) throw error;
      await sleep(1000);
    }
  }
}
async function ready() {
  const body = JSON.parse((await request('/api/ready',200)).text);
  assert.equal(body.database,true); assert.equal(body.redis,true);
}
const results: Record<string, unknown> = { timestamp: new Date().toISOString(), origin, scope: 'Local sequential smoke drill, not a 7-day SLO or load test' };
const stopped = new Set<string>();
function stop(service: string) { stopped.add(service); compose('stop',service); }
function start(service: string) { compose('start',service); stopped.delete(service); }
async function main() {
  await ready();
  const login = await fetch(`${origin}/api/users/login`, {
    method: 'POST', headers: { origin, 'content-type':'application/json' },
    body: JSON.stringify({ email:process.env.ADMIN_EMAIL ?? 'admin@uninerd.local', senha:process.env.ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(login.status,200); cookie = login.headers.get('set-cookie')!.split(';')[0];
  await request('/api/notifications',200);
  await request('/api/doctors',200);
  const samples: number[] = [];
  for (let i=0;i<30;i++) samples.push((await request('/api/doctors',200)).durationMs);
  samples.sort((a,b)=>a-b);
  results.warmDoctors = { requests: samples.length, p50Ms: samples[14], p95Ms: samples[28], targetP95Ms: 500 };
  try {
    stop('notifications');
    const failures = [];
    for (let i=0;i<4;i++) failures.push((await request('/api/notifications',503)).durationMs);
    const circuitMetrics = compose('exec','-T','backend','node','-e',"fetch('http://localhost:3001/internal/metrics').then(r=>r.text()).then(t=>process.stdout.write(t))");
    assert.match(circuitMetrics,/uninerd_notifications_circuit_state 1/);
    await request('/api/doctors',200);
    results.notifications = { statuses: [503,503,503,503], durationsMs: failures, circuitOpen: true, doctorsStatus: 200 };
    start('notifications'); await until(async () => { await request('/api/notifications',200); });
    stop('redis');
    const degraded = JSON.parse((await request('/api/ready',200)).text);
    assert.equal(degraded.database,true); assert.equal(degraded.redis,false); assert.equal(degraded.status,'degraded');
    const fallback = await request('/api/doctors',200);
    results.redis = { readiness: degraded, doctorsStatus: 200, fallbackDurationMs: fallback.durationMs };
    start('redis'); await until(ready);
    stop('db');
    await request('/api/health',200);
    const unavailable = JSON.parse((await request('/api/ready',503)).text); assert.equal(unavailable.database,false);
    await request('/api/users/me',503); await request('/login',200);
    results.mysql = { livenessStatus:200, readinessStatus:503, profileStatus:503, frontendLoginStatus:200 };
    start('db'); await until(ready); await request('/api/users/me',200);
  } finally {
    for (const service of ['db','redis','notifications']) if (stopped.has(service)) start(service);
    await until(ready);
    await until(async () => { await request('/api/notifications',200); });
  }
  await request('/internal/metrics',404);
  results.recovered = true; results.publicMetricsStatus = 404;
  mkdirSync('docs/evidencias',{ recursive:true });
  writeFileSync('docs/evidencias/qualidade-local.json',JSON.stringify(results,null,2)+'\n');
  const metrics = compose('exec','-T','backend','node','-e',"fetch('http://localhost:3001/internal/metrics').then(r=>r.text()).then(t=>process.stdout.write(t))");
  writeFileSync('docs/evidencias/qualidade-backend.prom',metrics);
  console.log(JSON.stringify(results,null,2));
}
main().catch(error => { console.error(error); process.exitCode=1; });
