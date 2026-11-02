import { rows, write } from '@/server/shared/database';
import type { DoctorDto } from './doctor.dto';
export interface Doctor { id: number; name: string; address: string; specialty: string; crm: string; crmUf: string }
export interface Specialty { id: number; name: string }
const select = `SELECT u.id, u.nome AS name, COALESCE(u.endereco,'') AS address, e.nome AS specialty,
  u.crm_numero AS crm, u.crm_uf AS crmUf FROM usuarios u JOIN especialidades e ON e.id=u.id_especialidade`;
export const doctorRepository = {
  async list(page: number, limit: number, term: string) {
    const where = ` WHERE u.nivel='medico' AND (u.nome LIKE ? OR e.nome LIKE ?)`;
    const params = [`%${term}%`, `%${term}%`];
    const data = await rows<Doctor>(`${select}${where} ORDER BY u.nome LIMIT ${limit} OFFSET ${(page-1)*limit}`, params);
    const [count] = await rows<{ total: number }>(`SELECT COUNT(*) AS total FROM usuarios u JOIN especialidades e ON e.id=u.id_especialidade${where}`, params);
    return { data, total: count.total, page, last_page: Math.max(1, Math.ceil(count.total / limit)) };
  },
  async byId(id: number) { return (await rows<Doctor>(`${select} WHERE u.id=? AND u.nivel='medico'`, [id]))[0]; },
  async occupiedHours(id: number, date: string) {
    return rows<{ time: string }>("SELECT DATE_FORMAT(data_consulta,'%H:%i') AS time FROM agendamentos WHERE id_medico=? AND DATE(data_consulta)=? AND status<>'CANCELADO'", [id,date]);
  },
  async specialties() { return rows<Specialty>('SELECT id, nome AS name FROM especialidades ORDER BY nome'); },
  async specialty(name: string) { return (await rows<Specialty>('SELECT id,nome AS name FROM especialidades WHERE nome=?', [name]))[0]; },
  async update(id: number, data: DoctorDto, specialtyId: number) {
    return write(`UPDATE usuarios SET nome=?,endereco=?,crm_numero=?,crm_uf=?,id_especialidade=? WHERE id=? AND nivel='medico'`,
      [data.name, data.address, data.crm, data.crmUf, specialtyId, id]);
  },
  async delete(id: number) { return write("DELETE FROM usuarios WHERE id=? AND nivel='medico'", [id]); },
  async createSpecialty(nome: string) { return write('INSERT INTO especialidades (nome) VALUES (?)', [nome]); },
  async updateSpecialty(id: number, nome: string) { return write('UPDATE especialidades SET nome=? WHERE id=?', [nome, id]); },
  async deleteSpecialty(id: number) { return write('DELETE FROM especialidades WHERE id=?', [id]); },
};
