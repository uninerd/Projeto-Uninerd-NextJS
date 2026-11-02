import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppointmentAggregate } from '../backend/src/server/modules/appointments/domain/appointment.aggregate';
import { ClinicSlot } from '../backend/src/server/modules/appointments/domain/clinic-slot';
import { AppointmentStatus, AppointmentType } from '../backend/src/server/modules/appointments/domain/appointment-values';
import { DomainError } from '../backend/src/server/modules/appointments/domain/domain-error';

const patient = { id: 2, nivel: 'paciente' as const };
const doctor = { id: 3, nivel: 'medico' as const };
const now = new Date('2026-10-18T12:00:00Z');
const original = { id: 1, patientId: 2, doctorId: 3, date: '2026-10-19T10:00:00', type: 'consulta', status: 'AGENDADO' };
const change = { doctorId: 3, date: original.date, type: original.type, status: 'AGENDADO' };

test('value objects compare by value and cannot be mutated', () => {
  const slot = ClinicSlot.from(original.date);
  assert.ok(slot.equals(ClinicSlot.from(original.date)));
  assert.ok(!slot.equals(ClinicSlot.from('2026-10-19T11:00:00')));
  assert.ok(AppointmentType.from('consulta').equals(AppointmentType.from('consulta')));
  assert.ok(!AppointmentType.from('consulta').equals(AppointmentType.from('exame')));
  assert.ok(AppointmentStatus.from('AGENDADO').equals(AppointmentStatus.from('AGENDADO')));
  assert.ok(Object.isFrozen(slot));
  assert.throws(() => Object.assign(slot, { value: 'invalid' }), TypeError);
});

test('clinic slots reject impossible dates, unsupported SQL years, offsets and non-hourly slots', () => {
  for (const date of ['2027-02-29T10:00:00','2026-04-31T10:00:00','0001-01-01T10:00:00',
    '2026-10-19T07:00:00','2026-10-19T18:00:00','2026-10-19T10:30:00','2026-10-19T10:00:00-03:00']) {
    assert.throws(() => ClinicSlot.from(date), DomainError, date);
  }
  assert.doesNotThrow(() => ClinicSlot.from('2028-02-29T08:00:00'));
  assert.doesNotThrow(() => ClinicSlot.from('2026-10-19T17:00:00'));
  assert.throws(() => AppointmentType.from('outro'), DomainError);
  assert.throws(() => AppointmentStatus.from('REABERTO'), DomainError);
});

test('scheduling requires a patient, valid references and a future clinic-local hour', () => {
  const aggregate = AppointmentAggregate.schedule(patient, change, now);
  assert.equal(aggregate.toSnapshot().patientId, patient.id);
  assert.equal(aggregate.toSnapshot().id, undefined);
  assert.equal(aggregate.toSnapshot().status, 'AGENDADO');
  assert.throws(() => AppointmentAggregate.schedule(doctor, change, now), /paciente/);
  assert.throws(() => AppointmentAggregate.schedule(patient, { ...change, doctorId: 0 }, now), /Identificador/);
  // 10:00 in São Paulo is exactly 13:00 UTC, not a future instant at this boundary.
  assert.throws(() => AppointmentAggregate.schedule(patient, change, new Date('2026-10-19T13:00:00Z')), /futuro/);
});

test('rehydration preserves identity and permits historical records without reopening them', () => {
  const aggregate = AppointmentAggregate.restore({ ...original, date: '2020-01-20T10:00:00', status: 'CONCLUIDO' });
  assert.equal(aggregate.toSnapshot().id, original.id);
  assert.throws(() => aggregate.cancel(doctor), /encerrados/);
  assert.throws(() => aggregate.update(doctor, change, now), /encerrados/);
});

test('failed transitions preserve all aggregate state', () => {
  const aggregate = AppointmentAggregate.restore(original);
  const snapshot = aggregate.toSnapshot();
  assert.throws(() => aggregate.update(doctor, { ...change, doctorId: 99 }, now), /transferir/);
  assert.deepEqual(aggregate.toSnapshot(), snapshot);
  assert.throws(() => aggregate.update(patient, { ...change, date: '2026-02-30T10:00:00' }, now), DomainError);
  assert.deepEqual(aggregate.toSnapshot(), snapshot);
  assert.throws(() => Object.assign(snapshot, { patientId: 99 }), TypeError);
});

test('only authorized participants cancel and cancellation is terminal', () => {
  const aggregate = AppointmentAggregate.restore(original);
  assert.throws(() => aggregate.cancel({ ...patient, id: 99 }), /acessar/);
  assert.equal(aggregate.toSnapshot().status, 'AGENDADO');
  aggregate.cancel(patient);
  assert.equal(aggregate.toSnapshot().status, 'CANCELADO');
  assert.throws(() => aggregate.update(patient, change, now), /encerrados/);
});

test('completion preserves appointment details and is forbidden to the patient', () => {
  const aggregate = AppointmentAggregate.restore(original);
  const complete = { ...change, status: 'CONCLUIDO' };
  assert.throws(() => aggregate.update(patient, complete, now), /Somente o médico/);
  assert.throws(() => aggregate.update(doctor, { ...complete, type: 'exame' }, now), /dados originais/);
  assert.throws(() => aggregate.update(doctor, { ...complete, date: '2026-10-19T11:00:00' }, now), /dados originais/);
  aggregate.update(doctor, complete, now);
  assert.equal(aggregate.toSnapshot().status, 'CONCLUIDO');
  assert.throws(() => aggregate.cancel(doctor), /encerrados/);
});

test('rescheduling preserves identity and rejects past slots', () => {
  const aggregate = AppointmentAggregate.restore(original);
  aggregate.update(patient, { ...change, date: '2026-10-20T11:00:00' }, now);
  assert.equal(aggregate.toSnapshot().id, original.id);
  assert.equal(aggregate.toSnapshot().date, '2026-10-20T11:00:00');
  assert.throws(() => aggregate.update(patient, { ...change, date: '2020-01-20T10:00:00' }, now), /futuro/);
});
