import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitOpenError, type CircuitState } from '../backend/src/server/shared/circuit-breaker';
import { routeLabel } from '../backend/src/server/shared/metrics';

test('circuit opens after threshold, permits only one recovery probe and closes on success', async () => {
  let now = 0; let calls = 0; const states: CircuitState[] = [];
  const circuit = new CircuitBreaker({ threshold: 3, cooldownMs: 15, now: () => now, onState: s => states.push(s) });
  const fail = async () => { calls++; throw new Error('down'); };
  for (let i=0;i<3;i++) await assert.rejects(circuit.execute(fail));
  await assert.rejects(circuit.execute(fail), CircuitOpenError); assert.equal(calls, 3);
  now = 15;
  let recover!: () => void;
  const probe = circuit.execute(() => new Promise<void>(resolve => { recover = resolve; }));
  await assert.rejects(circuit.execute(fail), CircuitOpenError);
  recover(); await probe;
  assert.equal(await circuit.execute(async () => 'ok'), 'ok');
  assert.deepEqual(states, ['open','half_open','closed']);
});
test('an older concurrent success cannot close a circuit opened by newer failures', async () => {
  let finish!: () => void;
  const circuit = new CircuitBreaker({ threshold: 1, cooldownMs: 10000 });
  const slow = circuit.execute(() => new Promise<void>(resolve => { finish = resolve; }));
  await assert.rejects(circuit.execute(async () => { throw new Error('down'); }));
  finish(); await slow;
  await assert.rejects(circuit.execute(async () => 'must not run'), CircuitOpenError);
});
test('failed recovery probe opens circuit for a new cooldown', async () => {
  let now = 0;
  const circuit = new CircuitBreaker({ threshold: 1, cooldownMs: 10, now: () => now });
  const fail = async () => { throw new Error('down'); };
  await assert.rejects(circuit.execute(fail)); now = 10;
  await assert.rejects(circuit.execute(fail)); now = 19;
  await assert.rejects(circuit.execute(fail), CircuitOpenError); now = 20;
  assert.equal(await circuit.execute(async () => 42), 42);
});
test('metric labels replace IDs and collapse arbitrary paths', () => {
  assert.equal(routeLabel('/api/doctors/123/availability'), '/api/doctors/:id/availability');
  assert.equal(routeLabel('/api/users/123'), '/api/users/:id');
  assert.equal(routeLabel('/api/users/sensitive@example.com'), 'unmatched');
  assert.equal(routeLabel('/api/users/login'), '/api/users/login');
});
