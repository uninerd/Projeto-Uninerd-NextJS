import { z } from 'zod';
import { registerDto } from '../users/user.dto';
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
