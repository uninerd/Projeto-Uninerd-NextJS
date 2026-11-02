import { database, rows, write } from '@/server/shared/database';
import type { Actor } from '@/server/shared/auth';
import { AppointmentAggregate, type AppointmentSnapshot } from './domain/appointment.aggregate';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { AppError } from '@/server/shared/errors';
export interface Appointment extends Omit<AppointmentSnapshot, 'id'> {
  id: number; patientName: string; doctorName: string;
}
const select = `SELECT a.id,a.id_usuario AS patientId,a.id_medico AS doctorId,
  DATE_FORMAT(a.data_consulta,'%Y-%m-%dT%H:%i:%s') AS date,a.tipo AS type,a.status,
  p.nome AS patientName,m.nome AS doctorName FROM agendamentos a
  JOIN usuarios p ON p.id=a.id_usuario JOIN usuarios m ON m.id=a.id_medico`;
export const appointmentRepository = {
  async list(actor: Actor, page: number, limit: number) {
    const where = actor.nivel === 'admin' ? '' : actor.nivel === 'medico' ? ' WHERE a.id_medico=?' : ' WHERE a.id_usuario=?';
    const params = actor.nivel === 'admin' ? [] : [actor.id];
    const data = await rows<Appointment>(`${select}${where} ORDER BY a.data_consulta ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`, params);
    const [count] = await rows<{ total: number }>(`SELECT COUNT(*) AS total FROM agendamentos a${where}`, params);
    return { data, total: count.total, page, last_page: Math.max(1, Math.ceil(count.total/limit)) };
  },
  async byId(id: number) { return (await rows<Appointment>(`${select} WHERE a.id=?`, [id]))[0]; },
  async create(aggregate: AppointmentAggregate) {
    const data = aggregate.toSnapshot();
    const result = await write(`INSERT INTO agendamentos (id_usuario,id_medico,data_consulta,tipo,status) VALUES (?,?,?,?,?)`,
      [data.patientId, data.doctorId, data.date.replace('T',' '), data.type, data.status]);
    return this.byId(result.insertId);
  },
  // Serialize changes to an appointment and validate its current state under the lock.
  async change(id: number, mutate: (aggregate: AppointmentAggregate) => void) {
    const connection = await database().getConnection();
    try {
      await connection.beginTransaction();
      const [found] = await connection.execute<RowDataPacket[]>(`${select} WHERE a.id=? FOR UPDATE`, [id]);
      if (!found[0]) throw new AppError(404, 'Agendamento não encontrado.');
      const aggregate = AppointmentAggregate.restore(found[0] as Appointment);
      mutate(aggregate);
      const data = aggregate.toSnapshot();
      await connection.execute<ResultSetHeader>(`UPDATE agendamentos SET id_medico=?,data_consulta=?,tipo=?,status=? WHERE id=?`,
        [data.doctorId, data.date.replace('T',' '), data.type, data.status, id]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return this.byId(id);
  },
};
