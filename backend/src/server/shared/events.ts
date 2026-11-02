import { randomUUID } from 'node:crypto';
import { redis } from './redis';
import { log } from './logger';
import { metrics } from './metrics';
export interface AppointmentEvent {
  eventId: string; event: 'appointment.created' | 'appointment.updated' | 'appointment.cancelled';
  appointmentId: number; patientId: number; doctorId: number; date: string; timestamp: string;
}
export async function publishAppointment(event: AppointmentEvent['event'], appointment: {
  id: number; patientId: number; doctorId: number; date: string;
}) {
  const payload: AppointmentEvent = {
    eventId: randomUUID(), event, appointmentId: appointment.id, patientId: appointment.patientId,
    doctorId: appointment.doctorId, date: appointment.date, timestamp: new Date().toISOString(),
  };
  try {
    const subscribers = await redis().publish('uninerd:appointments', JSON.stringify(payload));
    metrics.events.inc({ event, result: subscribers > 0 ? 'sent' : 'no_subscribers' });
    log('event.published', { eventId: payload.eventId, event, subscribers });
  } catch { metrics.events.inc({ event, result: 'failed' }); log('event.publish_failed', { eventId: payload.eventId, event, appointmentId: appointment.id }); }
}
