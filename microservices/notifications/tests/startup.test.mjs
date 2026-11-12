import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createStore } from '../src/store.mjs';

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('HTTP starts without Redis and existing inbox remains readable', { timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'uninerd-notifications-startup-'));
  const port = await unusedPort();
  const redisPort = await unusedPort();
  const key = 'synthetic-test-key-for-independent-startup';
  const store = createStore(join(directory, 'notifications.sqlite'));
  store.save({ eventId: '64771bc5-53f8-4d24-87c9-8acd9bf97752', event: 'appointment.created',
    appointmentId: 7, patientId: 1, doctorId: 2, date: '2027-01-20T10:00:00', timestamp: '2026-11-12T12:00:00.000Z' });
  store.close();
  const env = { ...process.env, NOTIFICATIONS_INTERNAL_KEY: key, DATA_DIRECTORY: directory,
    PORT: String(port), REDIS_URL: `redis://127.0.0.1:${redisPort}` };
  delete env.INTERNAL_KEY;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.mjs', import.meta.url))], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  try {
    const deadline = Date.now() + 10000;
    let response;
    while (Date.now() < deadline) {
      assert.equal(child.exitCode, null, output);
      try { response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) }); break; }
      catch { await delay(100); }
    }
    assert.ok(response, output);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'degraded' });
    const inbox = await fetch(`http://127.0.0.1:${port}/notifications/1`, { headers: { 'x-internal-key': key } });
    assert.equal(inbox.status, 200);
    const { data } = await inbox.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].appointmentId, 7);
    assert.equal((await fetch(`http://127.0.0.1:${port}/notifications/1`)).status, 401);
  } finally {
    child.kill('SIGTERM');
    await exited;
    for (const filename of readdirSync(directory)) unlinkSync(join(directory, filename));
    rmdirSync(directory);
  }
});
