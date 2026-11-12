import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { database, rows } from '@/server/shared/database';
import { AppError } from '@/server/shared/errors';

// The doctor's row serializes opening/closing slots with bookings and rescheduling.
export async function lockDoctorSchedule(connection: PoolConnection, doctorId: number) {
  const [doctors] = await connection.execute<RowDataPacket[]>("SELECT id FROM usuarios WHERE id=? AND nivel='medico' FOR UPDATE", [doctorId]);
  if (!doctors.length) throw new AppError(404, 'Médico não encontrado.');
}

export async function assertDoctorSlotOpen(connection: PoolConnection, doctorId: number, date: string) {
  const [slots] = await connection.execute<RowDataPacket[]>(`SELECT id_medico FROM horarios_medicos WHERE id_medico=? AND data_hora=?
    UNION ALL SELECT id_medico FROM agenda_semanal_medicos WHERE id_medico=? AND dia_semana=DAYOFWEEK(?)-1 AND hora=TIME(?)
    AND NOT EXISTS (SELECT 1 FROM agenda_dias_medicos WHERE id_medico=? AND data=?) LIMIT 1`,
    [doctorId, date.replace('T', ' '), doctorId, date.slice(0,10), date.replace('T', ' '), doctorId, date.slice(0,10)]);
  if (!slots.length) throw new AppError(409, 'Este horário não foi disponibilizado pelo médico. Escolha outro horário.');
}

export const doctorScheduleRepository = {
  async day(doctorId: number, date: string) {
    const [opened, occupied, overrides] = await Promise.all([
      rows<{ time: string }>(`SELECT DATE_FORMAT(data_hora,'%H:%i') AS time FROM horarios_medicos WHERE id_medico=? AND data_hora>=? AND data_hora<DATE_ADD(?, INTERVAL 1 DAY)
        UNION SELECT TIME_FORMAT(hora,'%H:%i') AS time FROM agenda_semanal_medicos WHERE id_medico=? AND dia_semana=DAYOFWEEK(?)-1
        AND NOT EXISTS (SELECT 1 FROM agenda_dias_medicos WHERE id_medico=? AND data=?) ORDER BY time`, [doctorId, date, date, doctorId, date, doctorId, date]),
      rows<{ time: string }>("SELECT DATE_FORMAT(data_consulta,'%H:%i') AS time FROM agendamentos WHERE id_medico=? AND data_consulta>=? AND data_consulta<DATE_ADD(?, INTERVAL 1 DAY) AND status<>'CANCELADO' ORDER BY data_consulta", [doctorId, date, date]),
      rows<{ data: string }>('SELECT data FROM agenda_dias_medicos WHERE id_medico=? AND data=?', [doctorId, date]),
    ]);
    const occupiedHours = occupied.map(slot => slot.time);
    return { doctorId, date, hours: [...new Set([...opened.map(slot => slot.time), ...occupiedHours])].sort(), occupiedHours, source: overrides.length ? 'date' as const : 'weekly' as const };
  },
  async available(doctorId: number, date: string) {
    const day = await this.day(doctorId, date);
    return day.hours.filter(hour => !day.occupiedHours.includes(hour)).map(time => ({ time }));
  },
  async save(doctorId: number, date: string, hours: string[]) {
    const connection = await database().getConnection();
    try {
      await connection.beginTransaction();
      await lockDoctorSchedule(connection, doctorId);
      const [occupied] = await connection.execute<RowDataPacket[]>("SELECT DATE_FORMAT(data_consulta,'%H:%i') AS time FROM agendamentos WHERE id_medico=? AND data_consulta>=? AND data_consulta<DATE_ADD(?, INTERVAL 1 DAY) AND status<>'CANCELADO' FOR UPDATE", [doctorId, date, date]);
      if (occupied.some(slot => !hours.includes(slot.time))) throw new AppError(409, 'Não é possível fechar um horário que já possui atendimento. Preserve os horários ocupados.');
      await connection.execute('INSERT IGNORE INTO agenda_dias_medicos (id_medico,data) VALUES (?,?)', [doctorId, date]);
      await connection.execute('DELETE FROM horarios_medicos WHERE id_medico=? AND data_hora>=? AND data_hora<DATE_ADD(?, INTERVAL 1 DAY)', [doctorId, date, date]);
      for (const hour of hours) await connection.execute('INSERT INTO horarios_medicos (id_medico,data_hora) VALUES (?,?)', [doctorId, `${date} ${hour}:00`]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return this.day(doctorId, date);
  },
  async week(doctorId: number) {
    const now = new Date(Date.now() - 3 * 3600000).toISOString().slice(0,19).replace('T', ' ');
    const [opened, occupied] = await Promise.all([
      rows<{ weekday: number; time: string }>("SELECT dia_semana AS weekday,TIME_FORMAT(hora,'%H:%i') AS time FROM agenda_semanal_medicos WHERE id_medico=?", [doctorId]),
      rows<{ weekday: number; time: string }>(`SELECT DAYOFWEEK(data_consulta)-1 AS weekday,DATE_FORMAT(data_consulta,'%H:%i') AS time FROM agendamentos a
        WHERE a.id_medico=? AND a.data_consulta>? AND a.status<>'CANCELADO'
        AND NOT EXISTS (SELECT 1 FROM agenda_dias_medicos d WHERE d.id_medico=a.id_medico AND d.data=DATE(a.data_consulta))`, [doctorId, now]),
    ]);
    return { doctorId, days: Array.from({ length: 7 }, (_, weekday) => {
      const occupiedHours = [...new Set(occupied.filter(slot => slot.weekday === weekday).map(slot => slot.time))].sort();
      return { weekday, hours: [...new Set([...opened.filter(slot => slot.weekday === weekday).map(slot => slot.time), ...occupiedHours])].sort(), occupiedHours };
    }) };
  },
  async saveWeek(doctorId: number, days: { weekday: number; hours: string[] }[]) {
    const connection = await database().getConnection();
    const now = new Date(Date.now() - 3 * 3600000).toISOString().slice(0,19).replace('T', ' ');
    try {
      await connection.beginTransaction();
      await lockDoctorSchedule(connection, doctorId);
      const [occupied] = await connection.execute<RowDataPacket[]>(`SELECT DAYOFWEEK(data_consulta)-1 AS weekday,DATE_FORMAT(data_consulta,'%H:%i') AS time FROM agendamentos a
        WHERE a.id_medico=? AND a.data_consulta>? AND a.status<>'CANCELADO'
        AND NOT EXISTS (SELECT 1 FROM agenda_dias_medicos d WHERE d.id_medico=a.id_medico AND d.data=DATE(a.data_consulta)) FOR UPDATE`, [doctorId, now]);
      if (occupied.some(slot => !days.some(day => day.weekday === slot.weekday && day.hours.includes(slot.time)))) {
        throw new AppError(409, 'Preserve os horários com atendimentos futuros ou configure as exceções por data antes de alterar a semana.');
      }
      await connection.execute('DELETE FROM agenda_semanal_medicos WHERE id_medico=?', [doctorId]);
      for (const day of days) for (const hour of day.hours) await connection.execute('INSERT INTO agenda_semanal_medicos (id_medico,dia_semana,hora) VALUES (?,?,?)', [doctorId, day.weekday, `${hour}:00`]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return this.week(doctorId);
  },
};
