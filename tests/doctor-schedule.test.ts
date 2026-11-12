import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doctorScheduleDto, doctorWeekDto } from '../backend/src/server/modules/doctors/doctor.dto';
import { doctorService } from '../backend/src/server/modules/doctors/doctor.service';
import { routeLabel } from '../backend/src/server/shared/metrics';

test('doctor schedule accepts explicit closure and rejects invalid dates, hours and duplicates', () => {
  assert.equal(doctorScheduleDto.safeParse({ date: '2027-02-10', hours: [] }).success, true);
  assert.equal(doctorScheduleDto.safeParse({ date: '2027-02-10', hours: ['08:00', '17:00'] }).success, true);
  for (const hours of [['07:00'], ['18:00'], ['10:30'], ['10:00', '10:00']]) {
    assert.equal(doctorScheduleDto.safeParse({ date: '2027-02-10', hours }).success, false);
  }
  for (const date of ['2027-02-30', '0000-01-01', '2027-02-10T10:00:00']) {
    assert.equal(doctorScheduleDto.safeParse({ date, hours: [] }).success, false);
  }
  assert.equal(doctorScheduleDto.safeParse({ date: '2027-02-10', hours: [], doctorId: 99 }).success, false);
});

test('weekly agenda distinguishes weekdays, accepts closed days and rejects repeated or invalid weekdays', () => {
  assert.equal(doctorWeekDto.safeParse({ days: [{ weekday: 1, hours: ['09:00'] }, { weekday: 3, hours: ['14:00'] }] }).success, true);
  assert.equal(doctorWeekDto.safeParse({ days: [] }).success, true);
  for (const days of [[{ weekday: 7, hours: [] }], [{ weekday: -1, hours: [] }], [{ weekday: 1, hours: ['12:30'] }], [{ weekday: 1, hours: [] }, { weekday: 1, hours: ['10:00'] }]]) {
    assert.equal(doctorWeekDto.safeParse({ days }).success, false);
  }
});

test('only the owner doctor can read or change the agenda before database access', async () => {
  const payload = { date: '2027-02-10', hours: ['10:00'] };
  for (const actor of [{ id: 2, nivel: 'paciente' as const }, { id: 2, nivel: 'admin' as const }, { id: 9, nivel: 'medico' as const }]) {
    for (const action of [() => doctorService.schedule(actor, 2, payload.date), () => doctorService.saveSchedule(actor, 2, payload), () => doctorService.weekSchedule(actor, 2), () => doctorService.saveWeekSchedule(actor, 2, { days: [] })]) {
      await assert.rejects(action, /Somente o próprio médico/);
    }
  }
});

test('agenda routes keep finite metric labels without doctor identifiers', () => {
  assert.equal(routeLabel('/api/doctors/321/schedule'), '/api/doctors/:id/schedule');
  assert.equal(routeLabel('/api/doctors/321/weekly-schedule'), '/api/doctors/:id/weekly-schedule');
});
