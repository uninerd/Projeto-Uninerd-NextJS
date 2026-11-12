import { z } from 'zod';
import { registerDto } from '../users/user.dto';
import { ClinicSlot } from '../appointments/domain/clinic-slot';
export const scheduleDate = z.iso.date().refine(value => ClinicSlot.isValid(`${value}T08:00:00`), 'Informe uma data válida.');
export const clinicHour = z.string().regex(/^(0[89]|1[0-7]):00$/, 'Escolha horas inteiras entre 08:00 e 17:00.');
export const doctorScheduleDto = z.object({
  date: scheduleDate,
  hours: z.array(clinicHour).max(10).refine(hours => new Set(hours).size === hours.length, 'Não repita os horários.'),
}).strict();
export type DoctorScheduleDto = z.infer<typeof doctorScheduleDto>;
export const doctorWeekDto = z.object({ days: z.array(z.object({
  weekday: z.number().int().min(0).max(6),
  hours: z.array(clinicHour).max(10).refine(hours => new Set(hours).size === hours.length, 'Não repita os horários.'),
}).strict()).max(7).refine(days => new Set(days.map(day => day.weekday)).size === days.length, 'Não repita os dias da semana.') }).strict();
export type DoctorWeekDto = z.infer<typeof doctorWeekDto>;
export const doctorDto = z.object({
  name: z.string().trim().min(2).max(100), address: z.string().trim().min(3).max(255),
  specialty: z.string().trim().min(1).max(100), crm: z.string().regex(/^\d{1,10}$/),
  crmUf: z.string().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/).default('SP'),
}).strict();
export const createDoctorDto = doctorDto.extend({ email: z.email().max(100), senha: z.string().min(8).max(128) });
export const specialtyDto = z.object({ nome: z.string().trim().min(2).max(100) }).strict();
export type DoctorDto = z.infer<typeof doctorDto>;
// Reuse the public registration rules when the administrator creates an account.
export const validateDoctorAccount = registerDto;
