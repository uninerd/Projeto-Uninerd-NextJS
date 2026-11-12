import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import type { Actor } from './auth';
import type { AppointmentSnapshot } from '../modules/appointments/domain/appointment.aggregate';
import { redis } from './redis';
import { log } from './logger';
import { metrics } from './metrics';
export interface AppointmentEvent {
  eventId: string;
  event: 'appointment.created' | 'appointment.updated' | 'appointment.rescheduled' | 'appointment.cancelled' | 'appointment.completed';
  appointmentId: number; patientId: number; doctorId: number; date: string; timestamp: string;
  actorId: number; actorRole: Actor['nivel']; type: string; status: string;
  previous?: { doctorId: number; date: string; type: string; status: string };
}
export function appointmentEvent(appointment: AppointmentSnapshot & { id: number }, actor: Actor, previous?: AppointmentSnapshot): AppointmentEvent {
  const event = !previous ? 'appointment.created'
    : appointment.status !== previous.status && appointment.status === 'CANCELADO' ? 'appointment.cancelled'
    : appointment.status !== previous.status && appointment.status === 'CONCLUIDO' ? 'appointment.completed'
    : appointment.date !== previous.date || appointment.doctorId !== previous.doctorId ? 'appointment.rescheduled'
    : 'appointment.updated';
  return {
    eventId: randomUUID(), event, appointmentId: appointment.id, patientId: appointment.patientId,
    doctorId: appointment.doctorId, date: appointment.date, type: appointment.type, status: appointment.status,
    actorId: actor.id, actorRole: actor.nivel, timestamp: new Date().toISOString(),
    ...(previous ? { previous: { doctorId: previous.doctorId, date: previous.date, type: previous.type, status: previous.status } } : {}),
  };
}
// Commit the appointment and event together; recovery acknowledges only after SQLite commits.
export async function recordAppointmentEvent(connection: PoolConnection, payload: AppointmentEvent) {
  await connection.execute('INSERT INTO appointment_outbox (event_id,payload) VALUES (?,?)', [payload.eventId, JSON.stringify(payload)]);
}
export async function publishAppointment(payload: AppointmentEvent) {
  try {
    const subscribers = await redis().publish('uninerd:appointments', JSON.stringify(payload));
    metrics.events.inc({ event: payload.event, result: subscribers > 0 ? 'sent' : 'no_subscribers' });
    log('event.published', { eventId: payload.eventId, event: payload.event, subscribers });
  } catch { metrics.events.inc({ event: payload.event, result: 'failed' }); log('event.publish_failed', { eventId: payload.eventId, event: payload.event, appointmentId: payload.appointmentId }); }
}
