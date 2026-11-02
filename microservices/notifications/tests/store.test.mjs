import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventDto } from '../src/events.mjs';
import { createStore } from '../src/store.mjs';
const event = {
  eventId: '64771bc5-53f8-4d24-87c9-8acd9bf97752', event: 'appointment.created',
  appointmentId: 1, patientId: 2, doctorId: 3, date: '2027-01-20T10:00:00', timestamp: '2026-10-13T12:00:00.000Z',
};
test('stores one notification per recipient and deduplicates repeated events', () => {
  const store = createStore(':memory:');
  try {
    store.save(event); store.save(event);
    assert.equal(store.list(2).length,1); assert.equal(store.list(3).length,1);
    assert.equal(store.list(4).length,0); assert.match(store.list(2)[0].message,/20\/01\/2027 às 10:00/);
  } finally { store.close(); }
});
test('rejects malformed events', () => {
  assert.equal(eventDto.safeParse(event).success,true);
  assert.equal(eventDto.safeParse({ ...event, patientId: -1 }).success,false);
  assert.equal(eventDto.safeParse({ ...event, event: 'unknown' }).success,false);
});
