import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentEvent } from '../backend/src/server/shared/events';
import { authorizeOutbox } from '../backend/src/server/shared/appointment-outbox';
import type { AppointmentSnapshot } from '../backend/src/server/modules/appointments/domain/appointment.aggregate';
const original: AppointmentSnapshot & { id: number } = { id: 1, patientId: 2, doctorId: 3, date: '2027-01-20T10:00:00', type: 'consulta', status: 'AGENDADO' };
const actor = { id: 2, nivel: 'paciente' as const };
test('appointment events distinguish creation, edits, rescheduling, cancellation and completion', () => {
  assert.equal(appointmentEvent(original,actor).event,'appointment.created');
  assert.equal(appointmentEvent({...original,type:'exame'},actor,original).event,'appointment.updated');
  assert.equal(appointmentEvent({...original,date:'2027-01-20T11:00:00'},actor,original).event,'appointment.rescheduled');
  const transfer=appointmentEvent({...original,doctorId:4},actor,original);
  assert.equal(transfer.event,'appointment.rescheduled'); assert.equal(transfer.previous?.doctorId,3);
  assert.equal(transfer.actorId,2); assert.equal(transfer.actorRole,'paciente');
  assert.equal(appointmentEvent({...original,status:'CANCELADO'},actor,original).event,'appointment.cancelled');
  assert.equal(appointmentEvent({...original,status:'CONCLUIDO'},{id:3,nivel:'medico'},original).event,'appointment.completed');
});
test('outbox rejects missing or invalid internal credentials before database access', () => {
  assert.throws(()=>authorizeOutbox(null)); assert.throws(()=>authorizeOutbox('invalid'));
});
