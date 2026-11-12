import { z } from 'zod';
export const eventDto = z.object({
  eventId: z.uuid(), event: z.enum(['appointment.created', 'appointment.updated', 'appointment.rescheduled', 'appointment.cancelled', 'appointment.completed']),
  appointmentId: z.number().int().positive(), patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(), date: z.string().min(16).max(30), timestamp: z.iso.datetime(),
  actorId: z.number().int().positive().optional(), actorRole: z.enum(['paciente','medico','admin']).optional(),
  type: z.enum(['consulta','exame']).optional(), status: z.enum(['AGENDADO','CANCELADO','CONCLUIDO']).optional(),
  previous: z.object({ doctorId: z.number().int().positive(), date: z.string().min(16).max(30),
    type: z.enum(['consulta','exame']), status: z.enum(['AGENDADO','CANCELADO','CONCLUIDO']) }).strict().optional(),
}).strict();
export function notificationMessage(event) {
  const actions = { 'appointment.created': 'criado', 'appointment.updated': 'atualizado', 'appointment.rescheduled': 'reagendado', 'appointment.cancelled': 'cancelado', 'appointment.completed': 'concluído' };
  const roles = { paciente: 'pelo paciente', medico: 'pelo médico', admin: 'pelo administrador' };
  const format = date => `${date.slice(0,10).split('-').reverse().join('/')} às ${date.slice(11,16)}`;
  let message = `Agendamento #${event.appointmentId} ${actions[event.event]}${event.actorRole ? ` ${roles[event.actorRole]}` : ''} para ${format(event.date)}.`;
  if (event.previous?.date !== undefined && event.previous.date !== event.date) message += ` Horário anterior: ${format(event.previous.date)}.`;
  if (event.previous && event.previous.doctorId !== event.doctorId) message += ' Médico responsável alterado.';
  if (event.previous && event.previous.type !== event.type) message += ` Tipo alterado de ${event.previous.type} para ${event.type}.`;
  return message;
}
