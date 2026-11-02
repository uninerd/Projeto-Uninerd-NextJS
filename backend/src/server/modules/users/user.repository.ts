import { rows, write } from '@/server/shared/database';
import type { Role } from '@/server/shared/auth';
import type { RegisterDto, UpdateUserDto } from './user.dto';
export interface UserRow {
  id: number; nome: string; email: string; senha: string; nivel: Role; cpf?: string;
  crm_numero?: string; crm_uf?: string; id_especialidade?: number;
}
export const userRepository = {
  async byId(id: number) { return (await rows<UserRow>('SELECT * FROM usuarios WHERE id = ?', [id]))[0]; },
  async byEmail(email: string) { return (await rows<UserRow>('SELECT * FROM usuarios WHERE email = ?', [email]))[0]; },
  async create(data: RegisterDto, hash: string) {
    const result = await write(`INSERT INTO usuarios (nome,email,senha,nivel,cpf,crm_numero,crm_uf,id_especialidade)
      VALUES (?,?,?,?,?,?,?,?)`, [data.nome, data.email, hash, data.nivel, data.nivel === 'paciente' ? data.cpf : null,
      data.nivel === 'medico' ? data.crm_numero : null, data.nivel === 'medico' ? data.crm_uf : null, data.nivel === 'medico' ? data.id_especialidade : null]);
    return result.insertId;
  },
  async update(id: number, data: UpdateUserDto) {
    const fields: string[] = []; const values: (string | number)[] = [];
    for (const key of ['nome', 'senha', 'cpf'] as const) {
      const value = data[key]; if (value !== undefined) { fields.push(`${key} = ?`); values.push(value); }
    }
    if (fields.length) await write(`UPDATE usuarios SET ${fields.join(',')} WHERE id = ?`, [...values, id]);
    return this.byId(id);
  },
  async delete(id: number) { await write('DELETE FROM usuarios WHERE id = ?', [id]); },
};
