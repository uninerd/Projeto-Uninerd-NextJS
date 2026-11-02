import { z } from 'zod';
import { ClinicSlot } from './domain/clinic-slot';
export const appointmentStatus = z.enum(['AGENDADO', 'CONCLUIDO', 'CANCELADO']);
export const clinicDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/)
  .refine(ClinicSlot.isValid, 'Informe uma data válida e um horário inteiro entre 08:00 e 17:00.');
export const appointmentDto = z.object({
  doctorId: z.number().int().positive(), date: clinicDate, type: z.enum(['consulta', 'exame']),
}).strict();
export const updateAppointmentDto = appointmentDto.extend({ status: appointmentStatus });
export type AppointmentDto = z.infer<typeof appointmentDto>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentDto>;
