import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from '../backend/src/server/shared/http';
import { registerDto, updateUserDto } from '../backend/src/server/modules/users/user.dto';
import { clinicDate, appointmentDto } from '../backend/src/server/modules/appointments/appointment.dto';
import { AppointmentAggregate, canAccessAppointment } from '../backend/src/server/modules/appointments/domain/appointment.aggregate';
import type { Appointment } from '../backend/src/server/modules/appointments/appointment.repository';
import { createSession, verifySession, checkOrigin } from '../backend/src/server/shared/auth';
import { handleRequest } from '../backend/src/server/controllers/api.controller';

test('profile DTO rejects privilege escalation and SQL column injection', () => {
  assert.equal(updateUserDto.safeParse({ nome: 'Paciente', nivel: 'admin' }).success,false);
  assert.equal(updateUserDto.safeParse({ 'nivel = admin': 'x' }).success,false);
  assert.equal(updateUserDto.safeParse({ nome: 'Novo nome' }).success,true);
});
test('public registration cannot create admins and validates patient identity', () => {
  assert.equal(registerDto.safeParse({ nome: 'Teste', email: 'test@example.com', senha: 'SenhaForte@123', nivel: 'admin' }).success,false);
  assert.equal(registerDto.safeParse({ nome: 'Teste', email: 'test@example.com', senha: 'SenhaForte@123', nivel: 'paciente', cpf: '00000000000' }).success,false);
});
test('appointment dates reject impossible days, non-hourly slots and timezone ambiguity', () => {
  for (const value of ['2027-02-30T10:00:00','2027-01-01T10:30:00','2027-01-01T18:00:00','2027-01-01T10:00:00Z','2027-01-01T10:00:00garbage']) {
    assert.equal(clinicDate.safeParse(value).success,false,value);
  }
  assert.equal(clinicDate.safeParse('2027-01-01T10:00:00').success,true);
  assert.equal(appointmentDto.safeParse({ doctorId: 1, date: '2027-01-01T10:00:00',type:'consulta',patientId:2 }).success,false);
});
const appointment: Appointment = { id:1,patientId:2,doctorId:3,date:'2027-01-01T10:00:00',status:'AGENDADO',type:'consulta',patientName:'Paciente',doctorName:'Médico' };
test('users only access appointments in their own role', () => {
  assert.equal(canAccessAppointment({ id:2,nivel:'paciente' },appointment),true);
  assert.equal(canAccessAppointment({ id:3,nivel:'medico' },appointment),true);
  assert.equal(canAccessAppointment({ id:3,nivel:'paciente' },appointment),false);
  assert.equal(canAccessAppointment({ id:99,nivel:'medico' },appointment),false);
});
test('patients cannot complete visits and closed appointments cannot be reopened', () => {
  const data = { doctorId:3,date:appointment.date,type:'consulta' as const,status:'CONCLUIDO' as const };
  assert.throws(() => AppointmentAggregate.restore(appointment).update({ id:2,nivel:'paciente' },data),/Somente o médico/);
  assert.doesNotThrow(() => AppointmentAggregate.restore(appointment).update({ id:3,nivel:'medico' },data));
  assert.throws(() => AppointmentAggregate.restore({ ...appointment,status:'CONCLUIDO' }).update({ id:3,nivel:'medico' },data),/encerrados/);
});
test('session validates signature, issuer and audience', async () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'a'.repeat(64);
  try {
    const token = await createSession({ id:3,nivel:'medico' });
    assert.deepEqual(await verifySession(token),{ id:3,nivel:'medico' });
    process.env.JWT_SECRET = 'b'.repeat(64);
    await assert.rejects(() => verifySession(token),/inválida/);
  } finally { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=previous; }
});
test('API denies unauthenticated access and cross-site writes before touching the database', async () => {
  const response = await handleRequest(new NextRequest('http://localhost:3000/api/appointments'));
  assert.equal(response.status,401);
  assert.ok(response.headers.get('x-request-id'));
  assert.throws(() => checkOrigin(new NextRequest('http://localhost:3000/api/users/login', { method:'POST',headers:{ origin:'https://evil.example','sec-fetch-site':'cross-site' } })),/Origem/);
  const wrongMethod = await handleRequest(new NextRequest('http://localhost:3000/api/users/register'));
  assert.equal(wrongMethod.status,405);
});
