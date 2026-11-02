import bcrypt from 'bcryptjs';
import { AppError, requireCondition } from '@/server/shared/errors';
import { invalidate } from '@/server/shared/redis';
import { userRepository, type UserRow } from './user.repository';
import type { RegisterDto, UpdateUserDto } from './user.dto';
export function publicUser(user: UserRow) {
  return { id: user.id, nome: user.nome, email: user.email, nivel: user.nivel, cpf: user.cpf,
    crm_numero: user.crm_numero, crm_uf: user.crm_uf, id_especialidade: user.id_especialidade };
}
export const userService = {
  async register(data: RegisterDto) {
    const hash = await bcrypt.hash(data.senha, 12);
    const id = await userRepository.create(data, hash);
    if (data.nivel === 'medico') await invalidate('doctors');
    return publicUser((await userRepository.byId(id))!);
  },
  async login(email: string, senha: string) {
    const user = await userRepository.byEmail(email);
    // Constant bcrypt work even for unknown accounts.
    const valid = await bcrypt.compare(senha, user?.senha ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
    if (!user || !valid) throw new AppError(401, 'Credenciais inválidas.');
    return publicUser(user);
  },
  async profile(id: number) {
    const user = await userRepository.byId(id); requireCondition(user, 404, 'Usuário não encontrado.'); return publicUser(user);
  },
  async update(id: number, data: UpdateUserDto) {
    const existing = await userRepository.byId(id); requireCondition(existing, 404, 'Usuário não encontrado.');
    requireCondition(!data.cpf || existing.nivel === 'paciente', 400, 'CPF disponível apenas para pacientes.');
    if (data.senha) data = { ...data, senha: await bcrypt.hash(data.senha, 12) };
    const updated = await userRepository.update(id, data);
    if (existing.nivel === 'medico') await invalidate('doctors');
    return publicUser(updated!);
  },
  async delete(id: number) {
    const existing = await userRepository.byId(id); requireCondition(existing, 404, 'Usuário não encontrado.');
    await userRepository.delete(id);
    if (existing.nivel === 'medico') await invalidate('doctors');
  },
};
