import { timingSafeEqual } from 'node:crypto';
import { rows, write } from './database';
import { AppError } from './errors';
export function authorizeOutbox(key: string | null) {
  const expected = process.env.NOTIFICATIONS_INTERNAL_KEY;
  if (!expected || !key || Buffer.byteLength(key) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) throw new AppError(401, 'Não autorizado.');
}
export async function pendingAppointmentEvents() {
  const pending = await rows<{ payload: unknown }>('SELECT payload FROM appointment_outbox WHERE acknowledged_at IS NULL ORDER BY sequence_id LIMIT 100');
  return pending.map(row => typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload);
}
export async function acknowledgeAppointmentEvents(ids: string[]) {
  await write(`UPDATE appointment_outbox SET acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP(3)) WHERE event_id IN (${ids.map(() => '?').join(',')})`, ids);
}
