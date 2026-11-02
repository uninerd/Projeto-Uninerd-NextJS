import { z } from 'zod';
export const eventDto = z.object({
  eventId: z.uuid(), event: z.enum(['appointment.created', 'appointment.updated', 'appointment.cancelled']),
  appointmentId: z.number().int().positive(), patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(), date: z.string().min(16).max(30), timestamp: z.iso.datetime(),
}).strict();
export function notificationMessage(event) {
  const actions = { 'appointment.created': 'criado', 'appointment.updated': 'atualizado', 'appointment.cancelled': 'cancelado' };
  return `Agendamento #${event.appointmentId} ${actions[event.event]} para ${event.date.slice(0,10).split('-').reverse().join('/')} às ${event.date.slice(11,16)}.`;
}
