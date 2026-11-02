import { z } from 'zod';
import { isValidCPF, isStrongPassword } from '@/shared/validators';
const name = z.string().trim().min(2).max(100);
const password = z.string().max(128).refine(isStrongPassword, 'A senha deve conter pelo menos 8 caracteres, maiúscula, minúscula, número e símbolo.');
const cpf = z.string().transform(v => v.replace(/\D/g, '')).refine(isValidCPF, 'CPF inválido.');
const uf = z.enum(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
const common = { nome: name, email: z.email().max(100).transform(v => v.toLowerCase()), senha: password };
export const registerDto = z.discriminatedUnion('nivel', [
  z.object({ ...common, nivel: z.literal('paciente'), cpf }).strict(),
  z.object({ ...common, nivel: z.literal('medico'), crm_numero: z.string().regex(/^\d{1,10}$/), crm_uf: uf, id_especialidade: z.number().int().positive() }).strict(),
]);
export const loginDto = z.object({ email: z.email().transform(v => v.toLowerCase()), senha: z.string().min(1).max(128) }).strict();
export const updateUserDto = z.object({ nome: name.optional(), senha: password.optional(), cpf: cpf.optional() }).strict()
  .refine(value => Object.keys(value).length > 0, 'Informe pelo menos um campo.');
export const paginationDto = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(10) });
export type RegisterDto = z.infer<typeof registerDto>;
export type UpdateUserDto = z.infer<typeof updateUserDto>;
