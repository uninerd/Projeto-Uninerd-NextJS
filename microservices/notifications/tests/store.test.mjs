import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eventDto } from '../src/events.mjs';
import { createStore } from '../src/store.mjs';
const event = {
  eventId: '64771bc5-53f8-4d24-87c9-8acd9bf97752', event: 'appointment.created',
  appointmentId: 1, patientId: 2, doctorId: 3, date: '2027-01-20T10:00:00', timestamp: '2026-10-13T12:00:00.000Z',
};
test('stores one notification per recipient and deduplicates repeated events', () => {
  const store = createStore(':memory:');
  try {
    assert.equal(store.save(event),2); assert.equal(store.save(event),0);
    assert.equal(store.list(2).length,1); assert.equal(store.list(3).length,1);
    assert.equal(store.list(4).length,0); assert.match(store.list(2)[0].message,/20\/01\/2027 às 10:00/);
  } finally { store.close(); }
});
test('rejects malformed events', () => {
  assert.equal(eventDto.safeParse(event).success,true);
  assert.equal(eventDto.safeParse({ ...event, patientId: -1 }).success,false);
  assert.equal(eventDto.safeParse({ ...event, event: 'unknown' }).success,false);
});
test('all lifecycle actions reach patient, current doctor, former doctor and acting administrator once', () => {
  const store = createStore(':memory:');
  try {
    const actions = ['created','updated','rescheduled','cancelled','completed'];
    for (const action of actions) {
      const payload = eventDto.parse({ ...event, eventId: randomUUID(), event: `appointment.${action}`,
        actorId: 4, actorRole: 'admin', type: 'exame', status: action === 'completed' ? 'CONCLUIDO' : action === 'cancelled' ? 'CANCELADO' : 'AGENDADO',
        previous: { doctorId: 5, date: '2027-01-19T09:00:00', type:'consulta', status:'AGENDADO' } });
      store.save(payload); store.save(payload);
    }
    for (const user of [2,3,4,5]) {
      const inbox=store.list(user); assert.equal(inbox.length,5);
      const text=inbox.map(n=>n.message).join(' ');
      for (const action of ['criado','atualizado','reagendado','cancelado','concluído']) assert.ok(text.includes(action));
      assert.match(text,/pelo administrador/); assert.match(text,/Horário anterior: 19\/01\/2027 às 09:00/);
      assert.match(text,/Médico responsável alterado/); assert.match(text,/Tipo alterado de consulta para exame/);
    }
    assert.equal(store.list(6).length,0);
  } finally { store.close(); }
});
test('history pagination retains events beyond the first hundred', () => {
  const store=createStore(':memory:');
  try {
    for(let index=0;index<105;index++) store.save({...event,eventId:randomUUID()});
    const first=store.list(2), second=store.list(2,100);
    assert.equal(first.length,100); assert.equal(second.length,5);
    assert.equal(new Set([...first,...second].map(n=>n.eventId)).size,105);
  } finally { store.close(); }
});
